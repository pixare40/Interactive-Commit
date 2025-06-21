package cli

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spf13/cobra"
)

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install interactive-commit git hooks",
	Long: `Install interactive-commit as a git hook in your repository.

Supports multiple installation modes:
  --local  : Install for current repository only (default)
  --global : Install for all repositories globally
  --team   : Install with team configuration`,
	RunE: runInstall,
}

var (
	installLocal  bool
	installGlobal bool
	installTeam   bool
)

func init() {
	installCmd.Flags().BoolVar(&installLocal, "local", true, "Install for current repository")
	installCmd.Flags().BoolVar(&installGlobal, "global", false, "Install globally for all repositories")
	installCmd.Flags().BoolVar(&installTeam, "team", false, "Install with team configuration")
}

func runInstall(cmd *cobra.Command, args []string) error {
	if installGlobal {
		fmt.Println("🌍 Installing globally...")
		return installGlobalHook()
	}
	
	if installTeam {
		fmt.Println("👥 Installing for team...")
		return fmt.Errorf("team installation not yet implemented")
	}
	
	fmt.Println("📁 Installing locally...")
	return installLocalHook()
}

func installLocalHook() error {
	// Check if we're in a git repository
	if _, err := os.Stat(".git"); os.IsNotExist(err) {
		return fmt.Errorf("not in a git repository - please run this command from the root of a git repository")
	}
	
	// Create hooks directory if it doesn't exist
	hooksDir := ".git/hooks"
	if err := os.MkdirAll(hooksDir, 0755); err != nil {
		return fmt.Errorf("failed to create hooks directory: %w", err)
	}
	
	// Get the path to the current executable
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	
	// Create the prepare-commit-msg hook
	hookPath := filepath.Join(hooksDir, "prepare-commit-msg")
	
	// Check if hook already exists
	if _, err := os.Stat(hookPath); err == nil {
		fmt.Printf("⚠️  Hook already exists at %s\n", hookPath)
		fmt.Print("Do you want to overwrite it? (y/N): ")
		var response string
		fmt.Scanln(&response)
		if response != "y" && response != "Y" {
			fmt.Println("Installation cancelled.")
			return nil
		}
	}
	
	// Create hook script
	hookScript := fmt.Sprintf(`#!/bin/sh
# Interactive-Commit git hook
# Automatically appends currently playing audio to commit messages

"%s" hook "$1" "$2" "$3"
`, execPath)
	
	// Write hook file
	if err := os.WriteFile(hookPath, []byte(hookScript), 0755); err != nil {
		return fmt.Errorf("failed to write hook file: %w", err)
	}
	
	fmt.Printf("✅ Successfully installed Interactive-Commit hook at %s\n", hookPath)
	fmt.Println("🎵 Your commits will now include currently playing audio!")
	fmt.Println("\nTo test it, try making a commit while playing music:")
	fmt.Println("  git add . && git commit -m \"feat: add awesome feature\"")
	
	return nil
}

func installGlobalHook() error {
	// Get global hooks directory
	hooksDir, err := getGlobalHooksDir()
	if err != nil {
		return fmt.Errorf("failed to determine global hooks directory: %w", err)
	}
	
	// Create global hooks directory if it doesn't exist
	if err := os.MkdirAll(hooksDir, 0755); err != nil {
		return fmt.Errorf("failed to create global hooks directory: %w", err)
	}
	
	// Get the path to the current executable
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	
	// Create the prepare-commit-msg hook
	hookPath := filepath.Join(hooksDir, "prepare-commit-msg")
	
	// Check if hook already exists
	if _, err := os.Stat(hookPath); err == nil {
		fmt.Printf("⚠️  Global hook already exists at %s\n", hookPath)
		fmt.Print("Do you want to overwrite it? (y/N): ")
		var response string
		fmt.Scanln(&response)
		if response != "y" && response != "Y" {
			fmt.Println("Installation cancelled.")
			return nil
		}
	}
	
	// Create hook script
	hookScript := fmt.Sprintf(`#!/bin/sh
# Interactive-Commit global git hook
# Automatically appends currently playing audio to commit messages

"%s" hook "$1" "$2" "$3"
`, execPath)
	
	// Write hook file
	if err := os.WriteFile(hookPath, []byte(hookScript), 0755); err != nil {
		return fmt.Errorf("failed to write global hook file: %w", err)
	}
	
	// Configure Git to use the global hooks directory
	if err := configureGlobalHooksPath(hooksDir); err != nil {
		return fmt.Errorf("failed to configure global hooks path: %w", err)
	}
	
	fmt.Printf("✅ Successfully installed Interactive-Commit global hook at %s\n", hookPath)
	fmt.Printf("🔧 Configured Git to use global hooks directory: %s\n", hooksDir)
	fmt.Println("🎵 All your repositories will now include currently playing audio in commits!")
	fmt.Println("\nTo test it, try making a commit in any repository while playing music:")
	fmt.Println("  cd /path/to/any/git/repo && git add . && git commit -m \"feat: add awesome feature\"")
	fmt.Println("\nTo disable global hooks, run:")
	fmt.Println("  git config --global --unset core.hooksPath")
	
	return nil
}

func getGlobalHooksDir() (string, error) {
	// Check if user already has a global hooks path configured
	cmd := exec.Command("git", "config", "--global", "core.hooksPath")
	if output, err := cmd.Output(); err == nil {
		existingPath := strings.TrimSpace(string(output))
		if existingPath != "" {
			// Expand ~ to home directory if needed
			if strings.HasPrefix(existingPath, "~/") {
				homeDir, err := os.UserHomeDir()
				if err != nil {
					return "", err
				}
				existingPath = filepath.Join(homeDir, existingPath[2:])
			}
			fmt.Printf("📁 Using existing global hooks directory: %s\n", existingPath)
			return existingPath, nil
		}
	}
	
	// Create our own global hooks directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	
	// Use XDG config directory on Linux/WSL, or .config on other systems
	var configDir string
	if runtime.GOOS == "linux" {
		if xdgConfig := os.Getenv("XDG_CONFIG_HOME"); xdgConfig != "" {
			configDir = xdgConfig
		} else {
			configDir = filepath.Join(homeDir, ".config")
		}
	} else {
		configDir = filepath.Join(homeDir, ".config")
	}
	
	return filepath.Join(configDir, "git", "hooks"), nil
}

func configureGlobalHooksPath(hooksDir string) error {
	// Always use absolute path - Git doesn't always expand ~ correctly
	cmd := exec.Command("git", "config", "--global", "core.hooksPath", hooksDir)
	return cmd.Run()
} 