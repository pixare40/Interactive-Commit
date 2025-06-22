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
		"Spotify.exe":                  "Spotify",
		"msedge.exe":                   "Microsoft Edge",
		"chrome.exe":                   "Google Chrome",
		"firefox.exe":                  "Firefox",
		"vlc.exe":                      "VLC",
		"Microsoft.ZuneMusic":          "Groove Music",
		"Microsoft.WindowsMediaPlayer": "Windows Media Player",
		"YouTubeMusic":                 "YouTube Music",
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

// MacOSDetector detects audio on macOS using AppleScript
type MacOSDetector struct{}

func (m *MacOSDetector) Name() string {
	return "macOS AppleScript"
}

func (m *MacOSDetector) IsAvailable() bool {
	// Only available on macOS
	if runtime.GOOS != "darwin" {
		return false
	}

	// Check if osascript is available
	_, err := exec.LookPath("osascript")
	return err == nil
}

func (m *MacOSDetector) Detect(ctx context.Context) (*MediaInfo, error) {
	// Try music apps first (they're more reliable)
	media, err := m.detectMusicApps(ctx)
	if err == nil && media != nil {
		return media, nil
	}

	// Fallback to browser detection
	return m.detectBrowserMedia(ctx)
}

func (m *MacOSDetector) detectMusicApps(ctx context.Context) (*MediaInfo, error) {
	apps := []struct {
		name   string
		source string
	}{
		{"Spotify", "Spotify"},
		{"Music", "Apple Music"},
		{"iTunes", "iTunes"},
	}

	for _, app := range apps {
		// First check if the app is actually playing
		playerStateCmd := fmt.Sprintf(`tell application "%s" to player state`, app.name)
		cmd := exec.CommandContext(ctx, "osascript", "-e", playerStateCmd)
		output, err := cmd.Output()
		if err != nil {
			continue // App not running or accessible
		}

		playerState := strings.TrimSpace(string(output))
		if playerState != "playing" {
			continue // Not currently playing
		}

		// Get track info
		titleCmd := fmt.Sprintf(`tell application "%s" to name of current track`, app.name)
		artistCmd := fmt.Sprintf(`tell application "%s" to artist of current track`, app.name)
		albumCmd := fmt.Sprintf(`tell application "%s" to album of current track`, app.name)

		titleResult, titleErr := exec.CommandContext(ctx, "osascript", "-e", titleCmd).Output()
		artistResult, artistErr := exec.CommandContext(ctx, "osascript", "-e", artistCmd).Output()
		albumResult, albumErr := exec.CommandContext(ctx, "osascript", "-e", albumCmd).Output()

		if titleErr != nil {
			continue
		}

		title := strings.TrimSpace(string(titleResult))
		if title == "" || title == "missing value" {
			continue
		}

		artist := ""
		if artistErr == nil {
			artist = strings.TrimSpace(string(artistResult))
			if artist == "missing value" {
				artist = ""
			}
		}

		album := ""
		if albumErr == nil {
			album = strings.TrimSpace(string(albumResult))
			if album == "missing value" {
				album = ""
			}
		}

		return &MediaInfo{
			Title:  title,
			Artist: artist,
			Album:  album,
			Source: app.source,
			Type:   "song",
		}, nil
	}

	return nil, nil
}

func (m *MacOSDetector) detectBrowserMedia(ctx context.Context) (*MediaInfo, error) {
	browsers := []string{"Google Chrome", "Safari", "Firefox"}

	for _, browserName := range browsers {
		script := fmt.Sprintf(`tell application "System Events" to tell process "%s" to name of every window`, browserName)
		cmd := exec.CommandContext(ctx, "osascript", "-e", script)
		output, err := cmd.Output()
		if err != nil {
			continue // Browser not running
		}

		windowTitles := strings.TrimSpace(string(output))
		if windowTitles == "" {
			continue
		}

		// Look for media windows with priority
		mediaWindows := m.findMediaWindows(windowTitles)
		if len(mediaWindows) == 0 {
			continue
		}

		// Parse the best media window
		title, artist := m.parseMediaTitle(mediaWindows[0])

		return &MediaInfo{
			Title:  title,
			Artist: artist,
			Album:  "",
			Source: "YouTube",
			Type:   "video",
		}, nil
	}

	return nil, nil
}

func (m *MacOSDetector) findMediaWindows(windowTitles string) []string {
	// Split windows more intelligently by looking for " - Google Chrome" as a delimiter
	// This approach is more reliable than splitting on ", " which can appear in song titles
	var lines []string

	// Find all occurrences of " - Google Chrome"
	chromePattern := " - Google Chrome"
	if strings.Contains(windowTitles, chromePattern) {
		// Split by the Chrome pattern, but keep the pattern with each window
		parts := strings.Split(windowTitles, chromePattern)
		for i, part := range parts {
			if i == len(parts)-1 && strings.TrimSpace(part) == "" {
				// Skip the last empty part
				continue
			}

			if i > 0 {
				// Add back the Chrome pattern to all parts except the first
				part = chromePattern + part
			} else if i < len(parts)-1 {
				// Add the Chrome pattern to the first part if it's not the only part
				part = part + chromePattern
			}

			// Clean up any leading/trailing commas and spaces
			part = strings.TrimSpace(part)
			if strings.HasPrefix(part, ", ") {
				part = strings.TrimPrefix(part, ", ")
			}
			if strings.HasSuffix(part, ",") {
				part = strings.TrimSuffix(part, ",")
			}

			if part != "" {
				lines = append(lines, part)
			}
		}
	} else {
		// Fallback to simple comma splitting if no Chrome pattern found
		lines = strings.Split(windowTitles, ", ")
	}

	var mediaWindows []string

	// Prioritize windows with "Audio playing" indicator
	var priorityWindows []string
	var regularWindows []string

	for _, windowTitle := range lines {
		if strings.Contains(windowTitle, "YouTube") || strings.Contains(windowTitle, "Music") {
			if strings.Contains(windowTitle, "Audio playing") {
				priorityWindows = append(priorityWindows, windowTitle)
			} else {
				regularWindows = append(regularWindows, windowTitle)
			}
		}
	}

	// Return priority windows first, then regular ones
	mediaWindows = append(mediaWindows, priorityWindows...)
	mediaWindows = append(mediaWindows, regularWindows...)

	return mediaWindows
}

func (m *MacOSDetector) parseMediaTitle(windowTitle string) (title, artist string) {
	// Clean up the window title first
	cleanTitle := windowTitle

	// Remove Chrome memory usage indicators
	cleanTitle = strings.ReplaceAll(cleanTitle, "– Audio playing", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "- High memory usage", "")

	// Remove memory usage patterns like "- 841 MB"
	if strings.Contains(cleanTitle, " MB - Google Chrome") {
		parts := strings.Split(cleanTitle, " MB - Google Chrome")
		if len(parts) > 0 {
			// Find the last " - " before " MB" to remove the memory info
			beforeMB := parts[0]
			lastDashIndex := strings.LastIndex(beforeMB, " - ")
			if lastDashIndex > 0 {
				cleanTitle = beforeMB[:lastDashIndex] + " - Google Chrome" + strings.Join(parts[1:], " MB - Google Chrome")
			}
		}
	}

	// Remove browser suffixes
	cleanTitle = strings.ReplaceAll(cleanTitle, "- Google Chrome", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "- YouTube", "")

	// Remove user indicators like "– Kabaji"
	if strings.Contains(cleanTitle, "–") {
		parts := strings.Split(cleanTitle, "–")
		if len(parts) > 1 {
			cleanTitle = strings.TrimSpace(parts[0])
		}
	}
	cleanTitle = strings.TrimSpace(cleanTitle)

	// Split by " - " to separate artist and title
	parts := strings.Split(cleanTitle, " - ")

	if len(parts) >= 2 {
		// The last part is the title, everything before is the artist(s)
		title = strings.TrimSpace(parts[len(parts)-1])
		artist = strings.TrimSpace(strings.Join(parts[:len(parts)-1], " - "))
	} else {
		// If no hyphen, the whole thing is the title
		title = cleanTitle
		artist = "Unknown"
	}

	// Final cleanup on title to remove extras
	title = m.cleanupTitle(title)

	return title, artist
}

func (m *MacOSDetector) cleanupTitle(title string) string {
	// Remove common video/audio indicators using simple string replacements
	titleLower := strings.ToLower(title)

	// Remove featured artists
	if strings.Contains(titleLower, "ft.") {
		parts := strings.Split(title, "ft.")
		if len(parts) > 0 {
			title = strings.TrimSpace(parts[0])
		}
	}
	if strings.Contains(titleLower, "feat.") {
		parts := strings.Split(title, "feat.")
		if len(parts) > 0 {
			title = strings.TrimSpace(parts[0])
		}
	}

	// Remove video indicators (case insensitive)
	videoPatterns := []string{
		"(Official Video)",
		"(official video)",
		"(Video)",
		"(video)",
		"(Official Music Video)",
		"(official music video)",
		"(Music Video)",
		"(music video)",
	}

	for _, pattern := range videoPatterns {
		title = strings.ReplaceAll(title, pattern, "")
	}

	// Remove audio indicators (case insensitive)
	audioPatterns := []string{
		"(Official Audio)",
		"(official audio)",
		"(Audio)",
		"(audio)",
	}

	for _, pattern := range audioPatterns {
		title = strings.ReplaceAll(title, pattern, "")
	}

	return strings.TrimSpace(title)
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
	am.detectors = append(am.detectors, &MacOSDetector{})
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
