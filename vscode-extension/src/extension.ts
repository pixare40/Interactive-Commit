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
        vscode.commands.registerCommand('interactive-commit.openSettings', openSettings)
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
            const message = `🎵 Currently playing: "${media.title}" by ${media.artist} (${media.source})`;
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showInformationMessage('🔇 No audio currently detected');
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

function showWelcomeMessage() {
    const message = '🎵 Interactive Commit is ready! Your commits will now include your soundtrack.';
    const openSettings = 'Open Settings';
    const testDetection = 'Test Detection';
    
    vscode.window.showInformationMessage(message, openSettings, testDetection)
        .then(selection => {
            if (selection === openSettings) {
                openSettings();
            } else if (selection === testDetection) {
                detectAudio();
            }
        });
} 