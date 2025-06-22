import * as vscode from 'vscode';
import { AudioDetector } from './audioDetector';
import { ConfigManager } from './configManager';

export class GitIntegration {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private audioDetector: AudioDetector,
        private config: ConfigManager
    ) {}

    register(): vscode.Disposable {
        // Hook into git operations via the SCM API
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        
        if (!gitExtension) {
            console.warn('Git extension not found');
            return new vscode.Disposable(() => {});
        }

        // Register input box provider to enhance commit messages
        this.registerCommitMessageProvider();

        // Register commit command wrapper
        this.registerCommitCommand();

        return new vscode.Disposable(() => {
            this.disposables.forEach(d => d.dispose());
        });
    }

    private registerCommitMessageProvider() {
        // Listen for when the SCM input box gets focus
        const disposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            if (!this.config.isEnabled()) {
                return;
            }

            // Check if this is a commit message editor
            if (editor?.document.uri.scheme === 'vscode-scm' || 
                editor?.document.fileName.includes('COMMIT_EDITMSG')) {
                await this.enhanceCommitMessage(editor);
            }
        });

        this.disposables.push(disposable);
    }

    private registerCommitCommand() {
        // Instead of intercepting git commands (which is complex and can break functionality),
        // we'll monitor the Source Control input and enhance it in real-time
        // The git hook remains the primary mechanism for commit enhancement
        
        // Set up a timer to periodically check and enhance the commit message
        const checkInterval = setInterval(async () => {
            if (this.config.isEnabled()) {
                await this.enhanceSourceControlInput();
            }
        }, 2000); // Check every 2 seconds
        
        // Clean up interval on disposal
        this.disposables.push({
            dispose: () => {
                clearInterval(checkInterval);
            }
        });
    }

    private async enhanceSourceControlInput() {
        try {
            // Get Git repositories through the Git extension API
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension?.isActive) {
                return;
            }

            const git = gitExtension.exports.getAPI(1);
            const repositories = git.repositories;
            
            for (const repo of repositories) {
                if (repo.inputBox) {
                    const currentMessage = repo.inputBox.value;
                    
                    // Only enhance if there's a message and it doesn't already have audio info
                    if (currentMessage && 
                        currentMessage.trim() !== '' && 
                        !currentMessage.includes('🎵') &&
                        !currentMessage.includes('Currently playing:')) {
                        
                        const audioInfo = await this.audioDetector.detectCurrentAudio();
                        if (audioInfo) {
                            const enhancement = this.formatCommitMessage(audioInfo);
                            
                            // Add the audio info to the commit message
                            repo.inputBox.value = currentMessage + '\n\n' + enhancement;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to enhance Source Control input:', error);
        }
    }

    private async enhanceCommitMessage(editor: vscode.TextEditor) {
        try {
            const media = await this.audioDetector.detectCurrentAudio();
            if (!media) {
                return;
            }

            const currentText = editor.document.getText();
            
            // Don't add if already has audio info
            if (currentText.includes('🎵 Currently playing:')) {
                return;
            }

            // Don't add to empty commits
            const meaningfulLines = currentText
                .split('\n')
                .filter(line => {
                    const trimmed = line.trim();
                    return trimmed && !trimmed.startsWith('#');
                });

            if (meaningfulLines.length === 0) {
                return;
            }

            const audioLine = this.formatAudioLine(media);
            const newText = currentText.trimEnd() + '\n\n' + audioLine;

            // Create edit to add audio info
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(currentText.length)
            );
            
            edit.replace(editor.document.uri, fullRange, newText);
            await vscode.workspace.applyEdit(edit);

        } catch (error) {
            console.error('Failed to enhance commit message:', error);
        }
    }

    private formatAudioLine(media: { title: string; artist: string; source: string }): string {
        const template = this.config.getCommitFormat();
        
        return template
            .replace('{title}', media.title)
            .replace('{artist}', media.artist)
            .replace('{source}', media.source);
    }

    private formatCommitMessage(media: { title: string; artist: string; source: string }): string {
        const template = this.config.getCommitFormat();
        
        return template
            .replace('{title}', media.title)
            .replace('{artist}', media.artist)
            .replace('{source}', media.source);
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
} 