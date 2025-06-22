import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './configManager';

const execAsync = promisify(exec);

export interface MediaInfo {
    title: string;
    artist: string;
    album?: string;
    source: string;
    type: string;
}

export interface AudioDetectorInterface {
    detect(): Promise<MediaInfo | null>;
    name: string;
    isAvailable(): Promise<boolean>;
}

export class AudioDetector {
    private detectors: AudioDetectorInterface[] = [];

    constructor(private config: ConfigManager) {
        this.initializeDetectors();
    }

    private initializeDetectors() {
        // Add detectors based on platform
        if (this.isWSL() || os.platform() === 'win32') {
            this.detectors.push(new WSLWindowsDetector());
        }
        
        if (os.platform() === 'linux') {
            this.detectors.push(new MPRISDetector());
        }
        
        if (os.platform() === 'darwin') {
            this.detectors.push(new MacOSDetector());
        }
    }

    async detectCurrentAudio(): Promise<MediaInfo | null> {
        const timeout = this.config.getTimeout();
        
        // Try each detector until one succeeds
        for (const detector of this.detectors) {
            try {
                if (await detector.isAvailable()) {
                    const result = await Promise.race([
                        detector.detect(),
                        new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), timeout)
                        )
                    ]);
                    
                    if (result) {
                        return result;
                    }
                }
            } catch (error) {
                console.warn(`Detector ${detector.name} failed:`, error);
                continue;
            }
        }
        
        return null;
    }

    private isWSL(): boolean {
        try {
            const fs = require('fs');
            if (fs.existsSync('/proc/version')) {
                const version = fs.readFileSync('/proc/version', 'utf8');
                return version.toLowerCase().includes('microsoft');
            }
        } catch {
            // Ignore errors
        }
        
        return process.env.WSL_DISTRO_NAME !== undefined;
    }

    getAvailableDetectors(): string[] {
        return this.detectors.map(d => d.name);
    }
}

class WSLWindowsDetector implements AudioDetectorInterface {
    name = 'WSL2/Windows Media Session';

    async isAvailable(): Promise<boolean> {
        try {
            // Try PowerShell Core first (pwsh.exe), then Windows PowerShell (powershell.exe)
            await execAsync('pwsh.exe -NoLogo -Command "Write-Host test"');
            return true;
        } catch {
            try {
                await execAsync('powershell.exe -NoLogo -Command "Write-Host test"');
                return true;
            } catch {
                return false;
            }
        }
    }

    async detect(): Promise<MediaInfo | null> {
        const script = `
# Suppress progress bars and verbose output
$ProgressPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'

try {
    # Check Spotify
    $spotify = Get-Process -Name 'Spotify' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne 'Spotify' }
    if ($spotify) {
        $title = $spotify.MainWindowTitle
        if ($title -match '(.+) - (.+)') {
            $artist = $matches[1]
            $song = $matches[2]
            $result = @{ Title = $song; Artist = $artist; Source = 'Spotify'; Type = 'song' }
            Write-Output ($result | ConvertTo-Json -Compress)
            exit 0
        }
    }
    
    # Check browsers for YouTube Music, YouTube, etc.
    $browsers = @('chrome', 'msedge', 'firefox')
    foreach ($browserName in $browsers) {
        $browser = Get-Process -Name $browserName -ErrorAction SilentlyContinue | Where-Object { 
            $_.MainWindowTitle -and 
            $_.MainWindowTitle -notlike '*New Tab*' -and 
            $_.MainWindowTitle -ne 'Google Chrome' -and 
            $_.MainWindowTitle -ne 'Microsoft Edge' -and 
            $_.MainWindowTitle -ne 'Firefox' 
        }
        if ($browser) {
            foreach ($proc in $browser) {
                $title = $proc.MainWindowTitle
                
                # YouTube Music pattern
                if ($title -match '(.+) - (.+) - YouTube Music') {
                    $song = $matches[1]
                    $artist = $matches[2]
                    $result = @{ Title = $song; Artist = $artist; Source = 'YouTube Music'; Type = 'song' }
                    Write-Output ($result | ConvertTo-Json -Compress)
                    exit 0
                }
                
                # Regular YouTube pattern
                if ($title -match '(.+) - (.+) - YouTube') {
                    $artist = $matches[1]
                    $song = $matches[2] -replace '\\s*\\([^)]*\\)\\s*', '' -replace '\\s*\\[[^\\]]*\\]\\s*', ''
                    $song = $song.Trim()
                    if ($song -eq '') { $song = $matches[2] }
                    $result = @{ Title = $song; Artist = $artist; Source = 'YouTube'; Type = 'video' }
                    Write-Output ($result | ConvertTo-Json -Compress)
                    exit 0
                }
            }
        }
    }
    
    # No media found - exit cleanly with no output
    exit 0
} catch {
    # Error occurred - exit cleanly with no output  
    exit 0
}`;

        try {
            // Write script to temp file to avoid command line escaping issues
            const tempFile = path.join(os.tmpdir(), `audio-detect-${Date.now()}.ps1`);
            fs.writeFileSync(tempFile, script, 'utf8');
            
            // Try PowerShell Core first, then Windows PowerShell
            let stdout: string;
            try {
                const result = await execAsync(`pwsh.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tempFile}"`);
                stdout = result.stdout;
            } catch {
                const result = await execAsync(`powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tempFile}"`);
                stdout = result.stdout;
            }
            
            let output = stdout.trim();
            
            // Clean up temp file
            try { fs.unlinkSync(tempFile); } catch {}
            
            // Filter out PowerShell banner lines
            const lines = output.split('\n');
            const filteredLines = lines.filter(line => {
                const trimmed = line.trim();
                return !trimmed.includes('Windows PowerShell') &&
                       !trimmed.includes('Copyright (C) Microsoft Corporation') &&
                       !trimmed.includes('Install the latest PowerShell') &&
                       !trimmed.includes('https://aka.ms/PSWindows') &&
                       !trimmed.startsWith('PS ') &&
                       trimmed !== '';
            });
            
            output = filteredLines.join('\n').trim();
            
            if (!output) {
                return null;
            }
            
            // Validate JSON before parsing
            let result;
            try {
                result = JSON.parse(output);
            } catch (jsonError) {
                console.warn('PowerShell output is not valid JSON:', output);
                return null;
            }
            
            return {
                title: result.Title || '',
                artist: result.Artist || '',
                source: result.Source || 'Unknown',
                type: result.Type || 'unknown'
            };
        } catch (error) {
            console.warn('WSL Windows detection failed:', error);
            return null;
        }
    }
}

class MPRISDetector implements AudioDetectorInterface {
    name = 'MPRIS/playerctl';

    async isAvailable(): Promise<boolean> {
        try {
            await execAsync('which playerctl');
            return true;
        } catch {
            return false;
        }
    }

    async detect(): Promise<MediaInfo | null> {
        try {
            const { stdout: title } = await execAsync('playerctl metadata title 2>/dev/null');
            if (!title.trim()) {
                return null;
            }

            const [artist, source] = await Promise.all([
                execAsync('playerctl metadata artist 2>/dev/null').then(r => r.stdout.trim()).catch(() => ''),
                execAsync('playerctl --list-all 2>/dev/null').then(r => r.stdout.split('\n')[0]?.split('.')[0] || 'Unknown').catch(() => 'Unknown')
            ]);

            return {
                title: title.trim(),
                artist: artist || '',
                source: source.charAt(0).toUpperCase() + source.slice(1).toLowerCase(),
                type: 'song'
            };
        } catch (error) {
            console.warn('MPRIS detection failed:', error);
            return null;
        }
    }
}

class MacOSDetector implements AudioDetectorInterface {
    name = 'macOS Now Playing';

    async isAvailable(): Promise<boolean> {
        return os.platform() === 'darwin';
    }

    async detect(): Promise<MediaInfo | null> {
        // TODO: Implement macOS Now Playing API integration
        // This would require native Node.js bindings or AppleScript
        return null;
    }
} 