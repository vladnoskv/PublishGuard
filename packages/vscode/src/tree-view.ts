import * as vscode from 'vscode';
import type { ScanResult, Issue } from '@publishguard/core';

type TreeStatus = 'idle' | 'scanning' | 'clean' | 'error' | 'warning' | 'failed';

export class IssueTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue?: string,
    public readonly issue?: Issue,
    public readonly children?: IssueTreeItem[],
  ) {
    super(label, collapsibleState);

    if (issue) {
      this.contextValue = 'issue';
      this.description = issue.file || undefined;
      this.tooltip = `${issue.rule}: ${issue.message}${issue.suggestion ? `\n${issue.suggestion}` : ''}`;
      this.command = {
        command: 'publishguard.openIssue',
        title: 'Open Issue',
        arguments: [this],
      };

      switch (issue.severity) {
        case 'error':
          this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
          break;
        case 'warning':
          this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
          break;
        case 'info':
          this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('infoForeground'));
          break;
      }
    }

    if (this.contextValue === 'category-error') {
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    } else if (this.contextValue === 'category-warning') {
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
    } else if (this.contextValue === 'category-info') {
      this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('infoForeground'));
    } else if (this.contextValue === 'clean') {
      this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    } else if (this.contextValue === 'scanning') {
      this.iconPath = new vscode.ThemeIcon('sync~spin');
    } else if (this.contextValue === 'idle') {
      this.iconPath = new vscode.ThemeIcon('shield');
    } else if (this.contextValue === 'failed') {
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    }
  }
}

export class PublishGuardTreeProvider implements vscode.TreeDataProvider<IssueTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<IssueTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: IssueTreeItem[] = [];
  private _status: TreeStatus = 'idle';

  constructor() {
    this.setIdle();
  }

  setStatus(status: TreeStatus) {
    this._status = status;
    this._onDidChangeTreeData.fire(undefined);
  }

  setIdle(): void {
    this._status = 'idle';
    this.items = [
      new IssueTreeItem('Ready to scan', vscode.TreeItemCollapsibleState.None, 'idle'),
      this.createActionItem('Scan', 'publishguard.scan', 'play'),
      this.createActionItem('Settings', 'publishguard.openSettings', 'settings-gear'),
    ];
    this._onDidChangeTreeData.fire(undefined);
  }

  setScanning(stage: string): void {
    this._status = 'scanning';
    this.items = [
      new IssueTreeItem('Scanning project', vscode.TreeItemCollapsibleState.None, 'scanning'),
      new IssueTreeItem(stage, vscode.TreeItemCollapsibleState.None),
    ];
    this._onDidChangeTreeData.fire(undefined);
  }

  setFailed(message: string): void {
    this._status = 'failed';
    this.items = [
      new IssueTreeItem('Scan failed', vscode.TreeItemCollapsibleState.None, 'failed'),
      new IssueTreeItem(message, vscode.TreeItemCollapsibleState.None),
      this.createActionItem('Scan', 'publishguard.scan', 'play'),
      this.createActionItem('Settings', 'publishguard.openSettings', 'settings-gear'),
    ];
    this._onDidChangeTreeData.fire(undefined);
  }

  update(result: ScanResult): void {
    const items: IssueTreeItem[] = [];

    const summaryLabel =
      result.issues.length === 0
        ? 'No issues found'
        : `Issues: ${result.summary.errors} errors, ${result.summary.warnings} warnings, ${result.summary.infos} infos`;

    items.push(
      new IssueTreeItem(
        summaryLabel,
        vscode.TreeItemCollapsibleState.None,
        result.issues.length === 0 ? 'clean' : undefined,
      ),
    );

    items.push(
      new IssueTreeItem(
        `Files to publish: ${result.publishedFiles.length}`,
        vscode.TreeItemCollapsibleState.None,
      ),
    );

    items.push(this.createActionItem('Scan', 'publishguard.scan', 'play'));
    items.push(this.createActionItem('Settings', 'publishguard.openSettings', 'settings-gear'));

    const categoryMap = new Map<string, Issue[]>();
    for (const issue of result.issues) {
      const cat = issue.category;
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(issue);
    }

    for (const [category, issues] of categoryMap) {
      const severity = issues.some((i) => i.severity === 'error')
        ? 'error'
        : issues.some((i) => i.severity === 'warning')
          ? 'warning'
          : 'info';

      const children = issues.map(
        (issue) =>
          new IssueTreeItem(
            `[${issue.rule}] ${issue.file || 'project'}`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            issue,
          ),
      );

      items.push(
        new IssueTreeItem(
          `${category} (${issues.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          `category-${severity}`,
          undefined,
          children,
        ),
      );
    }

    this.items = items;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: IssueTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: IssueTreeItem): vscode.ProviderResult<IssueTreeItem[]> {
    if (element) {
      return element.children ?? [];
    }
    return this.items;
  }

  getRootItems(): IssueTreeItem[] {
    return this.items;
  }

  getParent(element: IssueTreeItem): vscode.ProviderResult<IssueTreeItem> {
    for (const item of this.items) {
      if (item.children?.includes(element)) return item;
    }
    return undefined;
  }

  private createActionItem(label: string, command: string, icon: string): IssueTreeItem {
    const item = new IssueTreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.command = { command, title: label };
    item.iconPath = new vscode.ThemeIcon(icon);
    return item;
  }
}
