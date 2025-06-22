import * as vscode from 'vscode';
import { AudioDetector } from './audioDetector';
import { StatusBarManager } from './statusBarManager';
import { GitIntegration } from './gitIntegration';
import { ConfigManager } from './configManager';

let statusBarManager: StatusBarManager;
let gitIntegration: GitIntegration;
let audioDetector: AudioDetector;

export function activate(context: vscode.ExtensionContext) {
    console.log('🎵 Interactive Commit extension is now active!');

    // Initialize services
    const config = new ConfigManager();
    audioDetector = new AudioDetector(config);
    statusBarManager = new StatusBarManager(audioDetector, config);
    gitIntegration = new GitIntegration(audioDetector, config);

    // Register commands
    const commands = [
        vscode.commands.registerCommand('interactive-commit.detectAudio', detectAudio),
        vscode.commands.registerCommand('interactive-commit.toggleStatusBar', toggleStatusBar),
        vscode.commands.registerCommand('interactive-commit.openSettings', openSettings),
        vscode.commands.registerCommand('interactive-commit.nextTrack', nextTrack),
        vscode.commands.registerCommand('interactive-commit.previousTrack', previousTrack),
        vscode.commands.registerCommand('interactive-commit.playPause', playPause)
    ];

    // Register git integration
    const gitDisposable = gitIntegration.register();

    // Start status bar updates
    statusBarManager.start();

    // Add to subscriptions for cleanup
    context.subscriptions.push(
        ...commands,
        gitDisposable,
        statusBarManager
    );

    // Show welcome message on first install
    const extensionVersion = context.extension.packageJSON.version;
    const lastVersion = context.globalState.get('lastVersion');
    
    if (lastVersion !== extensionVersion) {
        showWelcomeMessage();
        context.globalState.update('lastVersion', extensionVersion);
    }
}

export function deactivate() {
    console.log('🎵 Interactive Commit extension deactivated');
    statusBarManager?.dispose();
    gitIntegration?.dispose();
}

async function detectAudio() {
    try {
        const media = await audioDetector.detectCurrentAudio();
        
        if (media) {
            const message = `$(music) Currently playing: "${media.title}" by ${media.artist} (${media.source})`;
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showInformationMessage('$(mute) No audio currently detected');
        }
    } catch (error) {
        console.error('Audio detection error:', error);
        vscode.window.showErrorMessage('Failed to detect audio: ' + (error as Error).message);
    }
}

function toggleStatusBar() {
    const config = vscode.workspace.getConfiguration('interactive-commit');
    const current = config.get('showStatusBar', true);
    config.update('showStatusBar', !current, vscode.ConfigurationTarget.Global);
    
    const message = !current ? 'Status bar enabled' : 'Status bar disabled';
    vscode.window.showInformationMessage(message);
}

function openSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'interactive-commit');
}

async function nextTrack() {
    try {
        const success = await audioDetector.nextTrack();
        if (success) {
            vscode.window.showInformationMessage('$(chevron-right) Next track');
        } else {
            vscode.window.showWarningMessage('$(warning) Could not skip to next track');
        }
    } catch (error) {
        console.error('Next track error:', error);
        vscode.window.showErrorMessage('Failed to skip track: ' + (error as Error).message);
    }
}

async function previousTrack() {
    try {
        const success = await audioDetector.previousTrack();
        if (success) {
            vscode.window.showInformationMessage('$(chevron-left) Previous track');
        } else {
            vscode.window.showWarningMessage('$(warning) Could not go to previous track');
        }
    } catch (error) {
        console.error('Previous track error:', error);
        vscode.window.showErrorMessage('Failed to go to previous track: ' + (error as Error).message);
    }
}

async function playPause() {
    try {
        const success = await audioDetector.playPause();
        if (success) {
            vscode.window.showInformationMessage('$(debug-pause) Play/Pause toggled');
        } else {
            vscode.window.showWarningMessage('$(warning) Could not toggle play/pause');
        }
    } catch (error) {
        console.error('Play/pause error:', error);
        vscode.window.showErrorMessage('Failed to toggle play/pause: ' + (error as Error).message);
    }
}

function showWelcomeMessage() {
    const message = '$(music) Interactive Commit is ready! Your commits will now include your soundtrack.';
    const openSettingsText = 'Open Settings';
    const testDetectionText = 'Test Detection';
    
    vscode.window.showInformationMessage(message, openSettingsText, testDetectionText)
        .then(selection => {
            if (selection === openSettingsText) {
                openSettings();
            } else if (selection === testDetectionText) {
                detectAudio();
            }
        });
} 