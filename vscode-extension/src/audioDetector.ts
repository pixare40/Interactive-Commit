import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
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
            // Check if PowerShell is accessible
            await execAsync('powershell.exe -Command "Write-Host test"');
            return true;
        } catch {
            return false;
        }
    }

    async detect(): Promise<MediaInfo | null> {
        const script = `
try {
    # Check Spotify
    $spotify = Get-Process -Name 'Spotify' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -ne 'Spotify' }
    if ($spotify) {
        $title = $spotify.MainWindowTitle
        if ($title -match '(.+) - (.+)') {
            $artist = $matches[1]
            $song = $matches[2]
            $result = @{ Title = $song; Artist = $artist; Source = 'Spotify'; Type = 'song' }
            $result | ConvertTo-Json -Compress
            exit
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
                    $result | ConvertTo-Json -Compress
                    exit
                }
                
                # Regular YouTube pattern
                if ($title -match '(.+) - (.+) - YouTube') {
                    $artist = $matches[1]
                    $song = $matches[2] -replace '\\s*\\([^)]*\\)\\s*', '' -replace '\\s*\\[[^\\]]*\\]\\s*', ''
                    $song = $song.Trim()
                    if ($song -eq '') { $song = $matches[2] }
                    $result = @{ Title = $song; Artist = $artist; Source = 'YouTube'; Type = 'video' }
                    $result | ConvertTo-Json -Compress
                    exit
                }
            }
        }
    }
    
    # No media found
    Write-Host ""
} catch {
    Write-Host ""
}`;

        try {
            const { stdout } = await execAsync(`powershell.exe -Command "${script.replace(/"/g, '`"')}"`);
            const output = stdout.trim();
            
            if (!output) {
                return null;
            }
            
            const result = JSON.parse(output);
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