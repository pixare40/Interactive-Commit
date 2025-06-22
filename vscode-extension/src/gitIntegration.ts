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
        // Intercept git commit commands
        const commands = [
            'git.commit',
            'git.commitStaged',
            'git.commitAll'
        ];

        commands.forEach(commandId => {
            const disposable = vscode.commands.registerCommand(
                `interactive-commit.${commandId}`,
                async (...args) => {
                    if (this.config.isEnabled()) {
                        await this.enhanceCommitWithAudio();
                    }
                    
                    // Execute original command
                    return vscode.commands.executeCommand(commandId, ...args);
                }
            );

            this.disposables.push(disposable);
        });
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

    private async enhanceCommitWithAudio() {
        try {
            const media = await this.audioDetector.detectCurrentAudio();
            if (!media) {
                return;
            }

            // Get the SCM input box and append audio info
            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension?.isActive) {
                return;
            }

            const git = gitExtension.exports.getAPI(1);
            const repositories = git.repositories;

            if (repositories.length === 0) {
                return;
            }

            const repo = repositories[0];
            const inputBox = repo.inputBox;
            
            if (!inputBox.value.includes('🎵 Currently playing:')) {
                const audioLine = this.formatAudioLine(media);
                inputBox.value = inputBox.value.trimEnd() + '\n\n' + audioLine;
            }

        } catch (error) {
            console.error('Failed to enhance commit with audio:', error);
        }
    }

    private formatAudioLine(media: { title: string; artist: string; source: string }): string {
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