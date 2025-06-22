import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './configManager';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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
            // Use execFile to avoid shell escaping issues  
            await execFileAsync('powershell.exe', ['-Command', 'Write-Host test']);
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
            $result = @{ Title = $song; Artist = $artist; Source = 'Spotify'; Album = '' }
            $result | ConvertTo-Json -Compress
            exit
        }
    }
    
    # Check Chrome/Edge for YouTube Music, YouTube, etc.
    $browsers = @('chrome', 'msedge', 'firefox')
    foreach ($browserName in $browsers) {
        $browser = Get-Process -Name $browserName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -notlike '*New Tab*' -and $_.MainWindowTitle -ne 'Google Chrome' -and $_.MainWindowTitle -ne 'Microsoft Edge' -and $_.MainWindowTitle -ne 'Firefox' }
        if ($browser) {
            foreach ($proc in $browser) {
                $title = $proc.MainWindowTitle
                
                # YouTube Music pattern: "Song Name - Artist - YouTube Music"
                if ($title -match '(.+) - (.+) - YouTube Music') {
                    $song = $matches[1]
                    $artist = $matches[2]
                    $result = @{ Title = $song; Artist = $artist; Source = 'YouTube Music'; Album = '' }
                    $result | ConvertTo-Json -Compress
                    exit
                }
                
                # Regular YouTube patterns
                # Pattern: "Artist - Song Title (extras) - YouTube - Google Chrome"
                if ($title -match '(.+) - (.+) - YouTube - Google Chrome$') {
                    $artist = $matches[1]
                    $songWithExtras = $matches[2]
                    # Clean up song title by removing common extras in parentheses/brackets
                    $cleanSong = $songWithExtras -replace '\\s*\\([^)]*\\)\\s*', '' -replace '\\s*\\[[^\\]]*\\]\\s*', ''
                    $cleanSong = $cleanSong.Trim()
                    if ($cleanSong -eq '') { $cleanSong = $songWithExtras }
                    $result = @{ Title = $cleanSong; Artist = $artist; Source = 'YouTube'; Album = '' }
                    $result | ConvertTo-Json -Compress
                    exit
                }
                
                # Pattern: "Video Title - YouTube - Google Chrome"
                if ($title -match '(.+) - YouTube - Google Chrome$') {
                    $videoTitle = $matches[1]
                    # Try to extract artist - song if it contains a dash
                    if ($videoTitle -match '(.+) - (.+)') {
                        $artist = $matches[1]
                        $song = $matches[2] -replace '\\s*\\([^)]*\\)\\s*', '' -replace '\\s*\\[[^\\]]*\\]\\s*', ''
                        $song = $song.Trim()
                        if ($song -eq '') { $song = $matches[2] }
                        $result = @{ Title = $song; Artist = $artist; Source = 'YouTube'; Album = '' }
                    } else {
                        $result = @{ Title = $videoTitle; Artist = ''; Source = 'YouTube'; Album = '' }
                    }
                    $result | ConvertTo-Json -Compress
                    exit
                }
                
                # Pattern for other browsers: "Artist - Song Title - YouTube"  
                if ($title -match '(.+) - (.+) - YouTube$') {
                    $artist = $matches[1]
                    $song = $matches[2]
                    $result = @{ Title = $song; Artist = $artist; Source = 'YouTube'; Album = '' }
                    $result | ConvertTo-Json -Compress
                    exit
                }
                
                # Generic YouTube pattern fallback
                if ($title -like '*YouTube*' -and $title -match '(.+) - (.+)') {
                    $part1 = $matches[1]
                    $part2 = $matches[2] -replace ' - YouTube.*', ''
                    # Clean up extras
                    $part2 = $part2 -replace '\\s*\\([^)]*\\)\\s*', '' -replace '\\s*\\[[^\\]]*\\]\\s*', ''
                    $part2 = $part2.Trim()
                    if ($part2 -eq '') { $part2 = $matches[2] -replace ' - YouTube.*', '' }
                    $result = @{ Title = $part2; Artist = $part1; Source = 'YouTube'; Album = '' }
                    $result | ConvertTo-Json -Compress
                    exit
                }
                
                # Generic browser media pattern (fallback)
                if ($title -match '(.+) - (.+)' -and $title -notlike '*Google*' -and $title -notlike '*Microsoft*' -and $title -notlike '*Firefox*') {
                    $song = $matches[2]
                    $artist = $matches[1]
                    $friendlyBrowser = switch ($browserName) {
                        'chrome' { 'Google Chrome' }
                        'msedge' { 'Microsoft Edge' }
                        'firefox' { 'Firefox' }
                        default { $browserName }
                    }
                    $result = @{ Title = $song; Artist = $artist; Source = $friendlyBrowser; Album = '' }
                    $result | ConvertTo-Json -Compress
                    exit
                }
            }
        }
    }
} catch {
    # Silently fail - no media playing
}`;

        try {
            // Use execFile to pass arguments directly like Go does (no shell interpretation)
            let stdout: string;
            try {
                const result = await execFileAsync('powershell.exe', ['-Command', script]);
                stdout = result.stdout;
            } catch (error) {
                console.warn('PowerShell execution failed:', error);
                return null;
            }
            
            let output = stdout.trim();
            
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
                album: result.Album || '',
                source: result.Source || 'Unknown',
                type: 'song'
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
        // First try AppleScript to get Now Playing info
        const nowPlaying = await this.getNowPlayingInfo();
        if (nowPlaying) {
            return nowPlaying;
        }

        // Fallback to browser window detection
        return await this.getBrowserMediaInfo();
    }

    private async getNowPlayingInfo(): Promise<MediaInfo | null> {
        // Try each app individually to avoid complex AppleScript control flow
        const apps = [
            { name: 'Spotify', source: 'Spotify' },
            { name: 'Music', source: 'Apple Music' },
            { name: 'iTunes', source: 'iTunes' }
        ];

        for (const app of apps) {
            try {
                // First check if the app is actually playing
                const playingCmd = `tell application "${app.name}" to player state`;
                const playingResult = await execAsync(`osascript -e '${playingCmd}'`);
                const playerState = playingResult.stdout.trim();
                
                // Only proceed if the player is actually playing
                if (playerState === 'playing') {
                    // Get track info using separate commands to avoid multi-line syntax issues
                    const titleCmd = `tell application "${app.name}" to name of current track`;
                    const artistCmd = `tell application "${app.name}" to artist of current track`;
                    const albumCmd = `tell application "${app.name}" to album of current track`;
                    
                    const [titleResult, artistResult, albumResult] = await Promise.all([
                        execAsync(`osascript -e '${titleCmd}'`).catch(() => ({ stdout: '' })),
                        execAsync(`osascript -e '${artistCmd}'`).catch(() => ({ stdout: '' })),
                        execAsync(`osascript -e '${albumCmd}'`).catch(() => ({ stdout: '' }))
                    ]);
                    
                    const title = titleResult.stdout.trim();
                    const artist = artistResult.stdout.trim();
                    const album = albumResult.stdout.trim();
                    
                    if (title && title !== 'missing value') {
                        return {
                            title: title,
                            artist: artist || '',
                            album: album || '',
                            source: app.source,
                            type: 'song'
                        };
                    }
                }
            } catch (error) {
                // App not running or no track playing, continue to next app
                continue;
            }
        }

        return null;
    }

    private async getBrowserMediaInfo(): Promise<MediaInfo | null> {
        // Try each browser individually to avoid complex AppleScript control flow
        const browsers = ['Google Chrome', 'Safari', 'Firefox'];

        for (const browserName of browsers) {
            try {
                const script = `tell application "System Events" to tell process "${browserName}" to name of every window`;
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                const output = stdout.trim();
                
                if (output) {
                    // Look for YouTube or Music windows
                    const lines = output.split(', ');
                    let mediaWindows: Array<{title: string, priority: number}> = [];
                    
                    for (const windowTitle of lines) {
                        if (windowTitle.includes('YouTube') || windowTitle.includes('Music')) {
                            // Prioritize windows that show audio is playing
                            let priority = 1;
                            if (windowTitle.includes('Audio playing')) {
                                priority = 3; // Highest priority
                            } else if (windowTitle.includes('YouTube Music')) {
                                priority = 2; // Medium priority
                            }
                            
                            mediaWindows.push({ title: windowTitle, priority });
                        }
                    }
                    
                    // Sort by priority (highest first) and process the best match
                    mediaWindows.sort((a, b) => b.priority - a.priority);
                    
                    if (mediaWindows.length > 0) {
                        const windowTitle = mediaWindows[0].title;
                        
                        // Extract song/artist from window title using similar patterns as Windows
                        let title = windowTitle;
                        let artist = '';
                        let source = browserName;

                        // Clean up the window title by removing browser-specific suffixes
                        let cleanTitle = windowTitle;
                        // Remove browser suffixes like " - Google Chrome – Kabaji" or " – Audio playing - Google Chrome"
                        cleanTitle = cleanTitle.replace(/ - Google Chrome.*$/, '');
                        cleanTitle = cleanTitle.replace(/ – Audio playing.*$/, '');
                        cleanTitle = cleanTitle.replace(/ - YouTube.*$/, '');
                        cleanTitle = cleanTitle.replace(/ – YouTube.*$/, '');

                        // YouTube Music pattern: "Song Name - Artist - YouTube Music"
                        const ytMusicMatch = cleanTitle.match(/(.+) - (.+) - YouTube Music/);
                        if (ytMusicMatch) {
                            title = ytMusicMatch[1];
                            artist = ytMusicMatch[2];
                            source = 'YouTube Music';
                        }
                        // YouTube pattern: "Artist - Song Title (Video) ft. Featured Artists"
                        else if (cleanTitle.match(/(.+) - (.+) \(Video\)/)) {
                            const ytMatch = cleanTitle.match(/(.+) - (.+) \(Video\)/);
                            if (ytMatch) {
                                artist = ytMatch[1];
                                let songTitle = ytMatch[2];
                                
                                // Handle featured artists in the song title
                                if (songTitle.includes(' ft. ')) {
                                    // Keep the main song title, remove the "ft." part for cleaner display
                                    songTitle = songTitle.split(' ft. ')[0];
                                }
                                
                                title = songTitle;
                                source = 'YouTube';
                            }
                        }
                        // YouTube pattern: "Artist - Song Title - YouTube"
                        else if (cleanTitle.match(/(.+) - (.+) - YouTube/)) {
                            const ytMatch = cleanTitle.match(/(.+) - (.+) - YouTube/);
                            if (ytMatch) {
                                artist = ytMatch[1];
                                title = ytMatch[2];
                                source = 'YouTube';
                            }
                        }
                        // Generic pattern: "Artist - Song"
                        else if (cleanTitle.match(/(.+) - (.+)/)) {
                            const genericMatch = cleanTitle.match(/(.+) - (.+)/);
                            if (genericMatch) {
                                artist = genericMatch[1];
                                title = genericMatch[2];
                            }
                        }

                        return {
                            title: title.trim(),
                            artist: artist.trim(),
                            album: '',
                            source: source,
                            type: 'song'
                        };
                    }
                }
            } catch (error) {
                // Browser not running or no media windows, continue to next browser
                continue;
            }
        }

        return null;
    }
} 