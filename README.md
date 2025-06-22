# Interactive-Commit

**Transform your git commits with the soundtrack of your code**

Interactive-Commit is a git hook that automatically appends your currently playing audio to commit messages, creating a rich narrative of your development journey. **Working solution for WSL2/Windows, Linux, and macOS environments.**

https://github.com/user-attachments/assets/68d1fdcf-912b-4f60-a9b5-76ed94cf1d0e
VSCode Extension
<img width="487" alt="Screenshot 2025-06-22 at 20 22 03" src="https://github.com/user-attachments/assets/e1522029-2f22-455a-bc33-888e3f3b0aca" />

## Quick Start

```bash
# Install the CLI tool
go install github.com/pixare40/interactive-commit@latest

# Option 1: Install for current repository only
interactive-commit install --local

# Option 2: Install globally for ALL repositories (recommended!)
interactive-commit install --global

# Make a commit and watch the magic happen!
git add . && git commit -m "fix: resolve authentication bug"
# Result: Your commit message + 🎵 Currently playing: "Focus Flow" by Lo-Fi Study Beats (Spotify)
```

## Features

- **Universal Audio Detection**: Works with Spotify, YouTube Music, Chrome, Edge, Firefox
- **WSL2/Windows Bridge**: Breakthrough solution for cross-platform audio detection
- **Privacy-First**: All audio data stays local on your machine
- **Single Binary**: Zero dependency installation

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Git Hook      │───▶│ Audio Detector   │───▶│ Commit Formatter│
│ (prepare-commit)│    │ (Platform Layer) │    │ (Template Engine)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Audio Sources    │
                    │ • Window Titles  │
                    │ • MPRIS/D-Bus    │
                    │ • PowerShell API │
                    │ • AppleScript    │
                    └──────────────────┘
```

## Platform Support

### Currently Working

| Platform | Audio Source | Method | Status |
|----------|-------------|---------|---------|
| WSL2 | Windows Spotify | Window Title Parsing | **Working** |
| WSL2 | Windows Browsers | Window Title Parsing | **Working** |
| Linux Native | MPRIS/D-Bus | `playerctl` | **Working** |
| macOS | Spotify/Apple Music/iTunes | AppleScript Player State | **Working** |
| macOS | Browser Media | AppleScript Window Titles | **Working** |

### WSL2/Windows Integration

**The Problem**: WSL2 runs in a separate Linux VM and traditionally can't access Windows audio streams.

**Current Solution**: 
1. **Window Title Bridge**: PowerShell queries Windows process window titles from WSL2
2. **Smart Pattern Matching**: Intelligent parsing of Spotify, YouTube Music, and browser titles
3. **Cross-Platform Communication**: Seamless WSL2 ↔ Windows process interaction

### macOS Integration

**The Solution**: Native AppleScript integration for comprehensive audio detection.

**Implementation**: 
1. **Player State Detection**: AppleScript queries actual playback state (playing/paused/stopped)
2. **Direct API Access**: Native access to Spotify, Apple Music, and iTunes metadata
3. **Browser Window Monitoring**: Intelligent parsing of browser window titles with priority for "Audio playing" indicators
4. **Smart Prioritization**: Prioritizes actively playing apps over paused ones

**Example Detection Patterns:**
- **Spotify**: `"Artist - Song Title"` → Parsed to structured data
- **YouTube Music**: `"Song - Artist - YouTube Music"` → Clean extraction  
- **Browser Media**: Generic `"Title - Source"` patterns for web players

## Installation

### Prerequisites
- Go 1.21+ 
- Git 2.9+
- For WSL2: PowerShell accessible via `powershell.exe`
- For Linux: Optional `playerctl` for MPRIS support
- For macOS: `osascript` (included with macOS) for AppleScript detection

### Install from Source
```bash
git clone https://github.com/pixare40/interactive-commit.git
cd interactive-commit
go build -o interactive-commit ./cmd/interactive-commit

# Install locally for current repo only
./interactive-commit install --local

# OR install globally for all repositories
./interactive-commit install --global
```

### Install from Release (Coming Soon)
```bash
# Download binary from GitHub releases
# curl -L https://github.com/pixare40/interactive-commit/releases/latest/download/interactive-commit-linux -o interactive-commit
# chmod +x interactive-commit && ./interactive-commit install --local
```

## Usage

### Install Hook

```bash
# Install for current repository only
interactive-commit install --local

# Install globally for ALL repositories (recommended!)
interactive-commit install --global

# Verify installation
interactive-commit detect
```

**Global vs Local Installation:**

| Mode | Command | Scope | Use Case |
|------|---------|-------|----------|
| **Local** | `--local` | Current repository only | Testing, specific projects |
| **Global** | `--global` | All repositories | Default recommendation |

**Global Installation Details:**
- Creates hooks in `~/.config/git/hooks/` (Linux/WSL2/macOS)
- Configures Git's `core.hooksPath` globally 
- Works automatically in ALL repositories
- To disable: `git config --global --unset core.hooksPath`

### Test Detection
```bash
# Test what's currently playing
interactive-commit detect

# Example output:
# 🎵 Detecting currently playing audio...
# 📡 Available detectors: 1
#   ✅ WSL2/Windows Media Session
# 
# 🎵 Currently playing:
#    Title:  Hamnitishi (feat. Talia Oyando)
#    Artist: E-Sir
#    Source: Spotify
#    Type:   song
#
# 💬 Commit message addition:
# 🎵 Currently playing: "Hamnitishi (feat. Talia Oyando)" by E-Sir (Spotify)
```

### Make Musical Commits
```bash
# Start playing music, then commit normally
git add .
git commit -m "feat: implement user authentication"

# Your commit message automatically becomes:
# feat: implement user authentication
#
# 🎵 Currently playing: "Coding Flow" by Lo-Fi Beats (Spotify)
```

## Development

### Project Structure
```
├── README.md                    # This file
├── cmd/interactive-commit/      # CLI entry point
│   └── main.go                 # Application main
├── internal/
│   ├── audio/                  # Audio detection engine
│   │   └── detector.go         # Multi-platform audio detection
│   └── cli/                    # Command-line interface
│       ├── root.go            # Root command & version
│       ├── detect.go          # Audio detection testing
│       ├── hook.go            # Git hook handler
│       └── install.go         # Hook installation
├── go.mod                      # Go module definition
└── go.sum                      # Dependency checksums
```

### Building from Source
```bash
# Clone and build
git clone https://github.com/pixare40/interactive-commit.git
cd interactive-commit
go mod tidy
go build -o interactive-commit ./cmd/interactive-commit

# Run tests
go test ./...

# Cross-compile for different platforms
GOOS=windows GOARCH=amd64 go build -o interactive-commit.exe ./cmd/interactive-commit
GOOS=darwin GOARCH=amd64 go build -o interactive-commit-macos ./cmd/interactive-commit
```

## Example Commits

```bash
# Music while coding
git commit -m "refactor: optimize database queries"
# Result:
# refactor: optimize database queries
#
# 🎵 Currently playing: "Bohemian Rhapsody" by Queen (Spotify)

# Podcast while debugging  
git commit -m "fix: resolve memory leak in worker pool"
# Result:
# fix: resolve memory leak in worker pool
#
# 🎵 Currently playing: "The Changelog #423: Building Better APIs" (YouTube Music)

# Focus music for deep work
git commit -m "feat: implement distributed caching layer"
# Result:
# feat: implement distributed caching layer
#
# 🎵 Currently playing: "Deep Focus" by Brain.fm (Microsoft Edge)
```

## Privacy & Data

- **100% Local**: All audio detection happens on your machine
- **No Telemetry**: No data sent to external services
- **No Storage**: Audio info only added to git commits you create
- **Opt-out Anytime**: Simply remove the git hook to disable.

## Troubleshooting

### Global Hooks Not Working?

```bash
# Check if global hooks path is configured
git config --global core.hooksPath

# Should show: /home/username/.config/git/hooks (absolute path)
# If it shows: ~/.config/git/hooks (with tilde), fix it:
git config --global core.hooksPath "$(echo ~/.config/git/hooks)"

# Verify the hook file exists and is executable
ls -la ~/.config/git/hooks/prepare-commit-msg

# Test the hook manually
cd /any/git/repo
interactive-commit detect
```

### WSL2 Audio Detection Issues?

```bash
# Verify PowerShell is accessible
powershell.exe -Command "Write-Host 'PowerShell working'"

# Test audio detection directly
interactive-commit detect
```

### Permission Issues?

```bash
# Make sure hook is executable
chmod +x ~/.config/git/hooks/prepare-commit-msg

# Check Git version (needs 2.9+)
git --version
```

## Roadmap

- **v0.1**: WSL2/Windows Spotify detection via window titles
- **v0.2**: Multi-browser support (Chrome, Edge, Firefox)  
- **v0.3**: Git hook installation system
- **v0.4**: Linux native MPRIS support improvements
- **v0.5**: macOS Now Playing integration
- **v0.6**: Global git hook installation
- **v0.7**: Configuration file support
- **v1.0**: Cross-platform stability & release

## Contributing

**High Priority:**
- **macOS Support**: Now Playing integration
- **Windows Native**: Direct Windows Media Foundation API support  
- **Config System**: `.interactive-commit.json` configuration
- **CI/CD**: Automated testing and releases
- **Documentation**: Usage examples and troubleshooting

**Getting Started:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with Interactive-Commit: `git commit -m "feat: add amazing feature"`
5. Push and create a Pull Request

## Acknowledgments

- **Windows Media Session API** for the inspiration (even though we ended up using window titles!)
- **MPRIS specification** for Linux audio standards
- **Cobra CLI** for excellent command-line interface framework
- **The WSL2 team** for making cross-platform development possible

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Ready to soundtrack your code?**

```bash
go install github.com/pixare40/interactive-commit@latest
interactive-commit install --local
git commit -m "feat: add musical commits to my workflow"
```

*Soundtrack your creations.*
