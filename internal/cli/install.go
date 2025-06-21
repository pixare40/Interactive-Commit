package cli

import (
	"fmt"
	"os"
	"path/filepath"

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
		return fmt.Errorf("global installation not yet implemented")
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