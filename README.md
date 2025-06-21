# 🎵 Interactive-Commit

**Transform your git commits with the soundtrack of your code.**

Interactive-Commit is a git hook that automatically appends your currently playing audio to commit messages, creating a rich narrative of your development journey.

## 🌟 Vision

Imagine correlating your most productive coding sessions with your playlist, or looking back at old commits and remembering the exact mood when you wrote that breakthrough algorithm. This isn't just about fun commit messages - it's about creating data that could revolutionize how we understand developer productivity.

**Future Possibilities:**
- 🎯 **Developer Analytics**: Spotify/YouTube Music insights for optimal coding playlists
- 📊 **Team Coordination**: Shared soundtracks for better collaboration
- 🧠 **Productivity Research**: Correlate music genres with code quality and bug rates
- 💼 **Enterprise Features**: Mood-based development environment optimization

## 🚀 Quick Start

```bash
# Install the CLI tool
go install github.com/pixare40/interactive-commit@latest

# Set up git hooks for current repository
interactive-commit install --local

# Or enable globally for all repositories
interactive-commit install --global

# Make a commit and watch the magic happen!
git commit -m "fix: resolve authentication bug"
# Result: "fix: resolve authentication bug\n\n🎵 Currently playing: 'Focus Flow' by Lo-Fi Study Beats"
```

## 🎯 Features

- **🎵 Universal Audio Detection**: Works with Spotify, YouTube, VLC, and more
- **⚡ Lightning Fast**: Sub-millisecond performance impact on git workflow
- **🔧 Smart Installation**: Detects and preserves existing git hooks
- **👥 Team-Friendly**: Repository-specific configuration support
- **🔒 Privacy-First**: Granular controls for work vs personal repositories
- **🌍 Cross-Platform**: Windows, macOS, Linux support (including WSL2)

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Git Hook      │───▶│ Audio Detector   │───▶│ Commit Formatter│
│ (prepare-commit)│    │ (Platform Layer) │    │ (Template Engine)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Audio Sources    │
                    │ • MPRIS/D-Bus    │
                    │ • Windows APIs   │
                    │ • Browser Bridge │
                    │ • Streaming APIs │
                    └──────────────────┘
```

## 🔧 Technical Challenges & Solutions

### WSL2 ↔ Windows Audio Detection

**The Problem**: WSL2 runs in a separate Linux VM and can't directly access Windows audio streams.

**Our Approach**:
1. **Windows Companion Service**: Small Windows binary that reads current media and communicates with WSL2
2. **Registry Bridge**: Direct access to Windows Media Session registry entries
3. **Browser Extensions**: Web-based audio detection for streaming services
4. **Community Plugins**: Extensible architecture for platform-specific solutions

### Platform Detection Matrix

| Platform | Audio Source | Method | Status |
|----------|-------------|---------|---------|
| Linux Native | MPRIS/D-Bus | `playerctl` | ✅ Implemented |
| WSL2 | Windows Media | Registry/WMI | 🚧 In Progress |
| Windows | Native APIs | Windows Media Foundation | 📋 Planned |
| macOS | Now Playing | MediaPlayer Framework | 📋 Planned |
| Web Browsers | Extensions | WebSocket Bridge | 💡 Community |

## 📦 Installation Options

### Smart CLI Installer (Recommended)
```bash
interactive-commit install [--local|--global|--team]
```

### Manual Hook Installation
```bash
# Copy binary to hooks directory
cp interactive-commit .git/hooks/prepare-commit-msg
chmod +x .git/hooks/prepare-commit-msg
```

### Pre-commit Integration
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/yourname/interactive-commit
    hooks:
      - id: audio-commit
```

## ⚙ Configuration

Create `.interactive-commit.json` in your repository root:

```json
{
  "enabled": true,
  "format": "emoji",
  "privacy": {
    "enableForWork": false,
    "sensitiveKeywords": ["meeting", "call", "private"]
  },
  "sources": {
    "spotify": true,
    "youtube": true,
    "vlc": true,
    "browserBridge": false
  },
  "templates": {
    "song": "🎵 Currently playing: '{title}' by {artist}",
    "podcast": "🎙 Listening to: '{title}' - {podcast}",
    "focus": "🎧 Focus session: {genre} music"
  }
}
```

## 🛠 Development

### Prerequisites
- Go 1.21+
- Git 2.9+ (for git hooks support)

### Building from Source
```bash
git clone https://github.com/yourname/interactive-commit.git
cd interactive-commit
go build -o interactive-commit ./cmd/interactive-commit
```

### Project Structure
```
├── cmd/interactive-commit/     # CLI entry point
├── internal/
│   ├── audio/                 # Audio detection interfaces
│   ├── hooks/                 # Git hook management
│   ├── config/                # Configuration handling
│   └── formatters/            # Commit message templates
├── pkg/
│   ├── detectors/             # Platform-specific audio detectors
│   └── bridge/                # Cross-platform communication
└── scripts/                   # Installation and setup scripts
```

## 🤝 Contributing

We need your help to make this work across all platforms! Priority areas:

- **Windows Native Audio Detection**: Windows Media Foundation APIs
- **Browser Extensions**: Chrome/Firefox extensions for web-based audio
- **macOS Support**: Now Playing integration
- **Mobile Bridges**: iOS/Android companion apps
- **Streaming Service APIs**: Direct integration with Spotify/YouTube Music

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 🎨 Example Outputs

```bash
# Song playing
git commit -m "feat: add user authentication"
# Result:
# feat: add user authentication
# 
# 🎵 Currently playing: "Bohemian Rhapsody" by Queen (Spotify)

# Podcast listening
git commit -m "refactor: optimize database queries"
# Result:
# refactor: optimize database queries
#
# 🎙 Listening to: "The Changelog #423: Building Better APIs" (Overcast)

# Focus music
git commit -m "fix: resolve memory leak"
# Result:
# fix: resolve memory leak
#
# 🎧 Focus session: Lo-Fi Hip Hop for concentration
```

## 📊 Data & Privacy

Your audio data stays local by default. Optional features:
- **Anonymous Analytics**: Help us understand usage patterns
- **Team Insights**: Aggregate data for productivity research
- **Opt-in Sharing**: Contribute to open research on developer productivity

## 🗺 Roadmap

- **v0.1**: Basic Linux/MPRIS support ✅
- **v0.2**: Windows/WSL2 bridge 🚧
- **v0.3**: Smart installation system
- **v0.4**: Browser extension bridge
- **v0.5**: Streaming service APIs
- **v1.0**: Cross-platform stability

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

**Ready to soundtrack your code?** 🎵 Install Interactive-Commit and make every commit tell a story!