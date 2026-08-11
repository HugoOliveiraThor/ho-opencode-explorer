import * as vscode from 'vscode';
import * as semver from 'semver';

export class NoReleasesError extends Error {
  constructor(message = 'No releases found for this repository') {
    super(message);
    this.name = 'NoReleasesError';
  }
}

export class UpdateService {
  private readonly repoOwner: string;
  private readonly repoName: string;

  constructor(repoOwner: string = 'HugoOliveiraThor', repoName: string = 'ho-opencode-explorer') {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
  }

  isUpdateAvailable(localVersion: string, remoteVersion: string): boolean {
    const local = semver.parse(localVersion);
    const remote = semver.parse(remoteVersion);

    if (!local || !remote) return false;

    return semver.gt(remote, local);
  }

  parseVersion(raw: string): string {
    return raw.replace(/^v/, '');
  }

  async checkForUpdates(localVersion: string): Promise<void> {
    try {
      const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new NoReleasesError();
        }
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const release = (await response.json()) as { tag_name: string; html_url: string };
      const remoteVersion = this.parseVersion(release.tag_name);

      if (this.isUpdateAvailable(localVersion, remoteVersion)) {
        const action = await vscode.window.showInformationMessage(
          `HO OpenCode Explorer v${remoteVersion} is available. Update now?`,
          'Install',
          'Later',
        );
        if (action === 'Install') {
          vscode.env.openExternal(vscode.Uri.parse(release.html_url));
        }
      } else {
        vscode.window.showInformationMessage(
          `HO OpenCode Explorer is up to date (v${localVersion})`,
        );
      }
    } catch (err) {
      vscode.window.showWarningMessage(this.getErrorMessage(err));
    }
  }

  getErrorMessage(err: unknown): string {
    if (err instanceof NoReleasesError) {
      return 'No releases published for this repository yet.';
    }
    return 'Could not check for updates. Check your internet connection.';
  }
}
