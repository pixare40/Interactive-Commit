# Interactive Commit - VSCode Extension

**Transform your git commits with the soundtrack of your code, directly in VSCode**

Automatically append your currently playing audio to commit messages with zero setup. Works seamlessly with Spotify, YouTube Music, browsers, and more - especially in WSL2/Windows environments.

## Features

- **Zero Setup**: Install and it just works - no git hooks to configure
- **Live Status Bar**: See your current track while coding
- **Auto-Enhancement**: Commit messages automatically include your soundtrack
- **Universal Detection**: Spotify, YouTube Music, Chrome, Edge, Firefox support
- **WSL2/Windows**: Breakthrough cross-platform audio detection
- **Fully Configurable**: Customize format, sources, refresh rate, and more

## Quick Start

1. **Install** from VSCode Marketplace
2. **Start coding** with music playing
3. **Commit as usual** - your soundtrack is automatically added!

```bash
# Your commit message:
feat: implement user authentication

# Becomes:
feat: implement user authentication

🎵 Currently playing: "Focus Flow" by Lo-Fi Study Beats (Spotify)
```

## Usage

### Automatic Enhancement
- Make commits normally through VSCode's Git panel
- Audio info is automatically appended to commit messages
- No additional steps required!

### Manual Detection
- **Command Palette**: `Interactive Commit: Detect Currently Playing Audio`
- **Status Bar**: Click the music icon to test detection
- **Settings**: `Interactive Commit: Open Settings`

### Status Bar Integration
- Shows currently playing track in real-time
- Click to test audio detection
- Color-coded status (green = playing, yellow = stopped, red = error)

## Configuration

Access settings via `File > Preferences > Settings > Extensions > Interactive Commit`

| Setting | Default | Description |
|---------|---------|-------------|
| **Enabled** | `true` | Enable/disable automatic audio detection |
| **Show Status Bar** | `true` | Display current track in status bar |
| **Audio Sources** | `[spotify, youtube, ...]` | Which audio sources to detect |
| **Commit Format** | `🎵 Currently playing: "{title}" by {artist} ({source})` | Message format template |
| **Refresh Interval** | `5000ms` | Status bar update frequency |
| **Timeout** | `3000ms` | Audio detection timeout |

### Format Templates

Customize your commit message format with these placeholders:

```json
{
  "interactive-commit.commitFormat": "🎵 {title} - {artist} via {source}"
}
```

**Available placeholders:**
- `{title}` - Song/video title
- `{artist}` - Artist name
- `{source}` - Audio source (Spotify, YouTube, etc.)
- `{album}` - Album name (when available)

## Platform Support

| Platform | Method | Status |
|----------|--------|---------|
| **WSL2** | Windows PowerShell Bridge | **Fully Working** |
| **Linux** | MPRIS/playerctl | **Fully Working** |
| **Windows** | PowerShell Window Titles | **Fully Working** |
| **macOS** | Now Playing API | **Coming Soon** |

### WSL2/Windows Magic
This extension solves the notorious WSL2 audio detection challenge:
- Uses PowerShell to query Windows process window titles
- Intelligent pattern matching for Spotify, browsers
- Seamless cross-VM communication

## Troubleshooting

### Common Issues

**Status bar shows "Detection Error"?**
- Ensure audio source is actually playing
- For WSL2: Verify `powershell.exe` is accessible
- For Linux: Install `playerctl` for MPRIS support

**Audio not detected in WSL2?**
```bash
# Test PowerShell access
powershell.exe -Command "Write-Host 'Test'"

# Should output: Test
```

**Extension not enhancing commits?**
- Check that "Enabled" is true in settings
- Verify you're making commits through VSCode (not terminal)
- Look for existing 🎵 lines (prevents duplicates)

### Reset Settings
```json
// In settings.json, remove or set to default:
{
  "interactive-commit.enabled": true,
  "interactive-commit.showStatusBar": true
}
```

## Examples

### Spotify Integration
```
fix: resolve authentication bug

🎵 Currently playing: "Bohemian Rhapsody" by Queen (Spotify)
```

### YouTube Music
```
feat: implement caching layer

🎵 Currently playing: "Lo-Fi Hip Hop" by ChilledCow (YouTube Music)
```

### Browser Detection
```
refactor: optimize database queries

🎵 Currently playing: "JavaScript Podcast #124" (Chrome)
```

## Privacy & Security

- **100% Local**: All audio detection happens on your machine
- **No Telemetry**: Zero data sent to external services
- **No Storage**: Audio info only added to commits you create
- **Open Source**: Full transparency in audio detection methods

## Roadmap

- **v1.0**: Core functionality with status bar
- **v1.1**: WSL2/Windows support
- **v1.2**: Advanced configuration options
- **v1.3**: macOS Now Playing integration
- **v1.4**: Playlist/album detection
- **v1.5**: Commit message templates

## Contributing

Found a bug or want to contribute? 

1. **Issues**: [Report bugs](https://github.com/pixare40/interactive-commit/issues)
2. **Features**: [Request features](https://github.com/pixare40/interactive-commit/issues)
3. **PRs**: [Contribute code](https://github.com/pixare40/interactive-commit/pulls)

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Ready to soundtrack your code in VSCode?**

Install from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=pixare40.interactive-commit) and start creating musical commits!

*Your code deserves a soundtrack.* 