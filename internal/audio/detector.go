package audio

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// MediaInfo represents currently playing media
type MediaInfo struct {
	Title    string
	Artist   string
	Album    string
	Source   string // "Spotify", "YouTube", "VLC", etc.
	Type     string // "song", "podcast", "video", etc.
	Duration time.Duration
	Position time.Duration
}

// Detector interface for different audio detection methods
type Detector interface {
	Detect(ctx context.Context) (*MediaInfo, error)
	Name() string
	IsAvailable() bool
}

// MPRISDetector detects audio via MPRIS (Linux native)
type MPRISDetector struct{}

func (m *MPRISDetector) Name() string {
	return "MPRIS/playerctl"
}

func (m *MPRISDetector) IsAvailable() bool {
	// Only available on Linux
	if runtime.GOOS != "linux" {
		return false
	}
	
	// Check if playerctl is installed
	_, err := exec.LookPath("playerctl")
	return err == nil
}

func (m *MPRISDetector) Detect(ctx context.Context) (*MediaInfo, error) {
	// Try to get metadata from playerctl
	title, err := m.getPlayerctlMetadata(ctx, "title")
	if err != nil {
		return nil, err
	}
	
	if title == "" {
		return nil, nil // No media playing
	}
	
	artist, _ := m.getPlayerctlMetadata(ctx, "artist")
	album, _ := m.getPlayerctlMetadata(ctx, "album")
	
	// Try to determine the source player
	source, _ := m.getActivePlayer(ctx)
	if source == "" {
		source = "Unknown"
	}
	
	return &MediaInfo{
		Title:  title,
		Artist: artist,
		Album:  album,
		Source: source,
		Type:   "song", // TODO: Better type detection
	}, nil
}

func (m *MPRISDetector) getPlayerctlMetadata(ctx context.Context, key string) (string, error) {
	cmd := exec.CommandContext(ctx, "playerctl", "metadata", key)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	
	return strings.TrimSpace(string(output)), nil
}

func (m *MPRISDetector) getActivePlayer(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "playerctl", "--list-all")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	
	players := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(players) > 0 && players[0] != "" {
		// Return the first active player, clean up the name
		player := players[0]
		if strings.Contains(player, ".") {
			parts := strings.Split(player, ".")
			return strings.ToUpper(parts[0][:1]) + strings.ToLower(parts[0][1:]), nil
		}
		return strings.ToUpper(player[:1]) + strings.ToLower(player[1:]), nil
	}
	
	return "", nil
}

// WSLWindowsDetector detects Windows audio from within WSL2
type WSLWindowsDetector struct{}

func (w *WSLWindowsDetector) Name() string {
	return "WSL2/Windows Media Session"
}

func (w *WSLWindowsDetector) IsAvailable() bool {
	// Check if we're in WSL
	if !w.isWSL() {
		return false
	}
	
	// Check if we can access PowerShell
	_, err := exec.LookPath("powershell.exe")
	return err == nil
}

func (w *WSLWindowsDetector) isWSL() bool {
	// Check for WSL indicators
	if _, err := os.Stat("/proc/version"); err == nil {
		content, err := os.ReadFile("/proc/version")
		if err == nil && strings.Contains(strings.ToLower(string(content)), "microsoft") {
			return true
		}
	}
	
	// Check WSL environment variable
	return os.Getenv("WSL_DISTRO_NAME") != ""
}

func (w *WSLWindowsDetector) Detect(ctx context.Context) (*MediaInfo, error) {
	// Use window titles approach - much more reliable than Windows Media Session API from WSL2
	scriptText := `
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
                    $cleanSong = $songWithExtras -replace '\s*\([^)]*\)\s*', '' -replace '\s*\[[^\]]*\]\s*', ''
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
                        $song = $matches[2] -replace '\s*\([^)]*\)\s*', '' -replace '\s*\[[^\]]*\]\s*', ''
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
                    $part2 = $part2 -replace '\s*\([^)]*\)\s*', '' -replace '\s*\[[^\]]*\]\s*', ''
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
}
`
	
	// Execute PowerShell script
	cmd := exec.CommandContext(ctx, "powershell.exe", "-Command", scriptText)
	output, err := cmd.Output()
	if err != nil {
		// Get stderr for debugging
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("PowerShell failed: %w, stderr: %s", err, string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("failed to query Windows Media Session: %w", err)
	}
	
	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" {
		return nil, nil // No media playing
	}

	
	// Parse JSON response
	var result struct {
		Title  string `json:"Title"`
		Artist string `json:"Artist"`
		Album  string `json:"Album"`
		Source string `json:"Source"`
	}
	
	if err := json.Unmarshal([]byte(outputStr), &result); err != nil {
		return nil, fmt.Errorf("failed to parse media session data: %w", err)
	}
	
	// Clean up source name
	source := w.cleanSourceName(result.Source)
	
	return &MediaInfo{
		Title:  result.Title,
		Artist: result.Artist,
		Album:  result.Album,
		Source: source,
		Type:   w.determineMediaType(result.Title, source),
	}, nil
}

func (w *WSLWindowsDetector) cleanSourceName(appId string) string {
	// Convert Windows app IDs to friendly names
	appMappings := map[string]string{
		"Spotify.exe":                    "Spotify",
		"msedge.exe":                    "Microsoft Edge",
		"chrome.exe":                    "Google Chrome",
		"firefox.exe":                   "Firefox", 
		"vlc.exe":                       "VLC",
		"Microsoft.ZuneMusic":           "Groove Music",
		"Microsoft.WindowsMediaPlayer": "Windows Media Player",
		"YouTubeMusic":                  "YouTube Music",
	}
	
	// Direct mapping
	if friendly, exists := appMappings[appId]; exists {
		return friendly
	}
	
	// Extract from app ID patterns
	if strings.Contains(strings.ToLower(appId), "spotify") {
		return "Spotify"
	}
	if strings.Contains(strings.ToLower(appId), "chrome") {
		return "Google Chrome"
	}
	if strings.Contains(strings.ToLower(appId), "edge") {
		return "Microsoft Edge"
	}
	if strings.Contains(strings.ToLower(appId), "youtube") {
		return "YouTube Music"
	}
	
	// Clean up generic patterns
	if strings.HasSuffix(appId, ".exe") {
		return strings.TrimSuffix(appId, ".exe")
	}
	
	// Handle Windows Store app format
	if strings.Contains(appId, "!") {
		parts := strings.Split(appId, "!")
		if len(parts) > 0 {
			return strings.Title(strings.ToLower(parts[0]))
		}
	}
	
	return appId
}

func (w *WSLWindowsDetector) determineMediaType(title, source string) string {
	// Basic media type detection based on source and title patterns
	source = strings.ToLower(source)
	title = strings.ToLower(title)
	
	// Podcast indicators
	if strings.Contains(source, "podcast") || 
	   strings.Contains(title, "episode") ||
	   strings.Contains(title, "podcast") {
		return "podcast"
	}
	
	// Video indicators  
	if strings.Contains(source, "youtube") ||
	   strings.Contains(source, "edge") ||
	   strings.Contains(source, "chrome") ||
	   strings.Contains(source, "firefox") {
		return "video"
	}
	
	// Default to song
	return "song"
}

// AudioManager orchestrates multiple detectors
type AudioManager struct {
	detectors []Detector
}

// NewAudioManager creates a new audio manager with platform-specific detectors
func NewAudioManager() *AudioManager {
	am := &AudioManager{}
	
	// Add detectors based on platform
	am.addDetectors()
	
	return am
}

// addDetectors adds appropriate detectors for the current platform
func (am *AudioManager) addDetectors() {
	// TODO: Add platform detection
	// For now, add all detectors and let them self-disable if unavailable
	
	am.detectors = append(am.detectors, &MPRISDetector{})
	am.detectors = append(am.detectors, &WSLWindowsDetector{})
}

// Detect tries all available detectors and returns the first successful result
func (am *AudioManager) Detect(ctx context.Context) (*MediaInfo, error) {
	for _, detector := range am.detectors {
		if !detector.IsAvailable() {
			continue
		}
		
		media, err := detector.Detect(ctx)
		if err == nil && media != nil {
			return media, nil
		}
	}
	
	return nil, fmt.Errorf("no audio detected from any source")
}

// ListDetectors returns all available detectors
func (am *AudioManager) ListDetectors() []Detector {
	var available []Detector
	for _, detector := range am.detectors {
		if detector.IsAvailable() {
			available = append(available, detector)
		}
	}
	return available
} 