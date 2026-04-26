import type { AppDefaultView, AppLanguage, AppTheme, WorkingDayNumber } from "../shared/contracts";

export interface UiCopy {
  sidebar: {
    workspaceLabel: string;
    copy: string;
    nav: {
      home: string;
      portfolio: string;
      roadmap: string;
      project: string;
      settings: string;
    };
    projectNameLabel: string;
    projectNamePlaceholder: string;
    codeLabel: string;
    codePlaceholder: string;
    createProject: string;
    emptyProjects: string;
    projectListLabel: string;
    projectListCollapsed: string;
    projectListExpanded: string;
    projectSearchPlaceholder: string;
    projectCount: (visible: number, total: number) => string;
    dataProtectionLabel: string;
    localBackups: string;
    autoBackupPolicy: string;
    backupNow: string;
    textGitBackup: string;
    noBackups: string;
    restorePreview: string;
  };
  project: {
    headerLabel: string;
    nameLabel: string;
    codeLabel: string;
    ownerLabel: string;
    ownerPlaceholder: string;
    totalTasks: string;
    openTasks: string;
    completedTasks: string;
    progress: string;
    timeline: string;
    timelineDay: string;
    timelineWeek: string;
    timelineMonth: string;
    timelineKeyboardHint: string;
    wbsTree: string;
    wbsTreeCopy: string;
    importWorkbook: string;
    exportWorkbook: string;
    templates: string;
    templatePanelHeading: string;
    templatePanelCopy: string;
    wbsTemplates: string;
    wbsTemplatesCopy: string;
    saveWbsTemplate: string;
    saveWbsTemplateHelp: string;
    saveWbsTemplateDisabled: string;
    projectTemplates: string;
    projectTemplatesCopy: string;
    saveProjectTemplate: string;
    saveProjectTemplateHelp: string;
    templateUpdatedAt: string;
    applyWbsTemplate: string;
    applyProjectTemplate: string;
    emptyTemplates: string;
    addRootRow: string;
    quickAddLabel: string;
    quickAddTitle: string;
    quickAddPlaceholder: string;
    quickAddButton: string;
    teamSummaryLabel: string;
    teamSummaryTitle: string;
    teamSummaryCopy: string;
    mainOwnerBadge: string;
    noAssignees: string;
    assigneeSummary: (open: number, done: number, overdue: number) => string;
    bulkAddLabel: string;
    bulkAddChildTitle: string;
    bulkAddRootTitle: string;
    bulkAddRootHelp: string;
    bulkAddPlaceholder: string;
    bulkAddButton: string;
    eventDayLabel: string;
    eventDayChildTitle: string;
    eventDayRootTitle: string;
    eventDayRootHelp: string;
    eventDayTitleLabel: string;
    eventDayTitlePlaceholder: string;
    eventDayDateLabel: string;
    eventDayButton: string;
    emptyFilteredRows: string;
    emptyTreeRows: string;
    emptyTimelineRows: string;
  };
  home: {
    heading: string;
    copy: string;
    placeholder: string;
    add: string;
    weekMilestonesMetric: string;
    inboxSubtitle: string;
    today: string;
    todaySubtitle: string;
    overdue: string;
    overdueSubtitle: string;
    postpone: string;
    postponeToday: string;
    postponeTomorrow: string;
    postponeWeekEnd: string;
    weekMilestones: string;
    weekMilestonesSubtitle: string;
    recentProjects: string;
    recentProjectsCopy: string;
    recentProgress: string;
    inboxTemplateConversion: string;
    inboxTemplateConversionHelp: string;
    inboxEmpty: string;
    todayEmpty: string;
    overdueEmpty: string;
    weekMilestonesEmpty: string;
    recentProjectsEmpty: string;
  };
  portfolio: {
    emptyTitle: string;
    emptyMessage: string;
    heading: string;
    copy: string;
    summaryTitle: string;
    summaryCopy: string;
    filterAll: string;
    filterOverdue: string;
    filterWeekMilestone: string;
    assigneeBoardTitle: string;
    assigneeBoardCopy: string;
    assigneeAll: string;
    assigneeAllHelp: string;
    assigneeSummary: (projectCount: number, open: number, overdue: number) => string;
    emptyFiltered: string;
  };
  roadmap: {
    emptyTitle: string;
    emptyMessage: string;
    heading: string;
    copy: string;
    scaleYear: string;
    scaleFy: string;
    filterAll: string;
    filterOverdue: string;
    filterMilestone: string;
    previousYear: string;
    nextYear: string;
    yearSpanLabel: string;
    yearSpanValue: (yearSpan: number) => string;
    itemHeader: string;
    workloadLabel: string;
    workloadTitle: string;
    workloadCopy: string;
    workloadPeople: (assigneeCount: number) => string;
    loading: string;
    emptyFiltered: string;
  };
  settings: {
    label: string;
    heading: string;
    copy: string;
    languageLabel: string;
    languageJa: string;
    languageEn: string;
    themeLabel: string;
    themeLight: string;
    themeDark: string;
    autoBackupEnabledLabel: string;
    autoBackupEnabledHelp: string;
    autoBackupRetentionLabel: string;
    excelDefaultPriorityLabel: string;
    excelDefaultAssigneeLabel: string;
    excelDefaultsHelp: string;
    weekStartsOnLabel: string;
    weekStartsOnMonday: string;
    weekStartsOnSunday: string;
    fyStartMonthLabel: string;
    workingDaysLegend: string;
    workingDaysHelp: string;
    defaultViewLabel: string;
    save: string;
    followUpLabel: string;
    followUpHeading: string;
    autoBackup: string;
    excelDefaults: string;
  };
  searchFilter: {
    toolbarLabel: string;
    openButton: string;
    clearButton: string;
    noActiveFilters: string;
    titleHome: string;
    titlePortfolio: string;
    titleRoadmap: string;
    titleProject: string;
    drawerLabel: string;
    drawerTitle: string;
    drawerCopy: string;
    closeButton: string;
    keywordLabel: string;
    keywordPlaceholder: string;
    projectLabel: string;
    allOption: string;
    portfolioLabel: string;
    statusLabel: string;
    priorityLabel: string;
    tagLabel: string;
    tagPlaceholder: string;
    assigneeLabel: string;
    assigneePlaceholder: string;
    overdueOnly: string;
    milestoneOnly: string;
    roadmapOnly: string;
    chipKeyword: string;
    chipProject: string;
    chipPortfolio: string;
    chipStatus: string;
    chipPriority: string;
    chipTag: string;
    chipAssignee: string;
  };
  importPreview: {
    heading: string;
    selectedWorkbook: string;
    apply: string;
    close: string;
    policyNote: string;
    warningSummaryHeading: string;
    warningSummaryCopy: string;
    warningOnlyHeading: string;
    warningOnlyCopy: string;
    filterAll: string;
    filterWarning: string;
    filterError: string;
    emptyAll: string;
    emptyWarning: string;
    emptyError: string;
    rowLabel: string;
    actionLabel: string;
    projectLabel: string;
    titleLabel: string;
    validationLabel: string;
    fieldLabel: string;
    beforeLabel: string;
    afterLabel: string;
    compareOpen: string;
    compareClose: string;
  };
  recovery: {
    label: string;
    heading: string;
    copy: string;
    recentBackupsLabel: string;
    candidatesHeading: string;
    noBackups: string;
  };
  backupPreview: {
    heading: string;
    copy: string;
    close: string;
    projectsLabel: string;
    itemsLabel: string;
    updatedLabel: string;
    fileLabel: string;
    createdLabel: string;
    sizeLabel: string;
    restoreDisabledNote: string;
    confirmHeading: string;
    confirmCopy: string;
    cancel: string;
    restore: string;
    afterRestoreNote: string;
  };
}

const JA_COPY: UiCopy = {
  sidebar: {
    workspaceLabel: "Workspace",
    copy: "Home / Inbox / Quick Capture を追加しつつ、Project Detail の最小 CRUD を維持しています。",
    nav: {
      home: "ホーム / 今日",
      portfolio: "ポートフォリオ",
      roadmap: "年次 / FY",
      project: "プロジェクト詳細",
      settings: "設定",
    },
    projectNameLabel: "プロジェクト名",
    projectNamePlaceholder: "例: 基幹刷新",
    codeLabel: "コード",
    codePlaceholder: "例: PRJ-001",
    createProject: "プロジェクト作成",
    emptyProjects: "まず1つプロジェクトを作成して下さい",
    projectListLabel: "Projects",
    projectListCollapsed: "表示",
    projectListExpanded: "折りたたむ",
    projectSearchPlaceholder: "プロジェクト検索",
    projectCount: (visible, total) => `${visible} / ${total} 件`,
    dataProtectionLabel: "Data Protection",
    localBackups: "Local Backups",
    autoBackupPolicy: "自動: 起動時に日次1回 / auto 7件保持",
    backupNow: "Backup now",
    textGitBackup: "Text Git backup",
    noBackups: "まだ backup はありません。",
    restorePreview: "Restore Preview",
  },
  project: {
    headerLabel: "プロジェクト詳細",
    nameLabel: "名前",
    codeLabel: "コード",
    ownerLabel: "メイン担当",
    ownerPlaceholder: "例: 佐藤",
    totalTasks: "総タスク",
    openTasks: "未完了",
    completedTasks: "完了",
    progress: "進捗",
    timeline: "日付単位ガント",
    timelineDay: "1日単位",
    timelineWeek: "週",
    timelineMonth: "月",
    timelineKeyboardHint: "ガントは日付単位です。Alt+←/→ で1日移動、Alt+Shift+←/→ で右端を1日調整できます。",
    wbsTree: "WBS Tree",
    wbsTreeCopy: "インデント / アウトデント、優先度、担当、日付、タグ表示までをこのグリッドで編集できます。",
    importWorkbook: "Excel Import",
    exportWorkbook: "Excel Export",
    templates: "Templates",
    templatePanelHeading: "Template Library",
    templatePanelCopy: "保存済み template を current project へ適用するか、新しい project 作成に使います。",
    wbsTemplates: "WBS Templates",
    wbsTemplatesCopy: "current project の root 直下へ subtree を追加します。",
    saveWbsTemplate: "selected root を保存",
    saveWbsTemplateHelp: "selected root row を WBS template として保存します。",
    saveWbsTemplateDisabled: "WBS template を保存するには root row を選択して下さい。",
    projectTemplates: "Project Templates",
    projectTemplatesCopy: "template から新しい project を作成して開きます。",
    saveProjectTemplate: "current project を保存",
    saveProjectTemplateHelp: "current project を project template として保存します。",
    templateUpdatedAt: "更新日時",
    applyWbsTemplate: "current project へ適用",
    applyProjectTemplate: "新しい project を作成",
    emptyTemplates: "まだ template はありません。",
    addRootRow: "ルート行を追加",
    quickAddLabel: "Quick task add",
    quickAddTitle: "プロジェクト直下にタスクを追加",
    quickAddPlaceholder: "例: 要件レビュー",
    quickAddButton: "タスク追加",
    teamSummaryLabel: "Team",
    teamSummaryTitle: "担当者別の状況",
    teamSummaryCopy: "メイン担当と各タスク担当を集計します。クリックするとこのプロジェクトを担当者で絞り込みます。",
    mainOwnerBadge: "主担当",
    noAssignees: "担当者はまだ未設定です",
    assigneeSummary: (open, done, overdue) => `未完了 ${open} / 完了 ${done} / 遅延 ${overdue}`,
    bulkAddLabel: "複数サブタスク追加",
    bulkAddChildTitle: "選択行の下にまとめて追加",
    bulkAddRootTitle: "プロジェクト直下にまとめて追加",
    bulkAddRootHelp: "行を選択すると、その下にサブタスクとして追加できます。",
    bulkAddPlaceholder: "例:\n要件整理\nデザイン確認\n見積作成\nレビュー\n修正\n承認\nリリース準備",
    bulkAddButton: "まとめて追加",
    eventDayLabel: "イベント日追加",
    eventDayChildTitle: "選択行の下にイベント日を追加",
    eventDayRootTitle: "プロジェクト直下にイベント日を追加",
    eventDayRootHelp: "行を選択すると、その下にイベント日を登録できます。",
    eventDayTitleLabel: "イベント名",
    eventDayTitlePlaceholder: "例: 顧客レビュー日",
    eventDayDateLabel: "イベント日",
    eventDayButton: "イベント日追加",
    emptyFilteredRows: "条件に合う row はありません。",
    emptyTreeRows: "親・子・孫を作れる最小 CRUD から開始して下さい。",
    emptyTimelineRows: "日付が入った項目を表示します",
  },
  home: {
    heading: "今日やることを1行で追加",
    copy: "例: 見積提出 4/25 #営業 @自分 / 設計レビュー 4/28 15:00 60分",
    placeholder: "タスクを入力。例: 見積提出 4/25 #営業 @自分",
    add: "追加",
    weekMilestonesMetric: "今週MS",
    inboxSubtitle: "未計画タスク",
    today: "今日",
    todaySubtitle: "今日にかかるタスク",
    overdue: "期限切れ",
    overdueSubtitle: "危険箇所",
    postpone: "一括延期",
    postponeToday: "今日へ",
    postponeTomorrow: "明日へ",
    postponeWeekEnd: "今週末へ",
    weekMilestones: "今週のマイルストーン",
    weekMilestonesSubtitle: "直近確認",
    recentProjects: "最近更新したプロジェクト",
    recentProjectsCopy: "Project row クリックで Project Detail へ移動します。",
    recentProgress: "進捗",
    inboxTemplateConversion: "テンプレート変換",
    inboxTemplateConversionHelp: "draft project を作成して Templates を開きます。",
    inboxEmpty: "今のところ未整理はありません",
    todayEmpty: "今日の予定はありません",
    overdueEmpty: "期限切れはありません",
    weekMilestonesEmpty: "今週のマイルストーンはありません",
    recentProjectsEmpty: "まず1つプロジェクトを作成して下さい",
  },
  portfolio: {
    emptyTitle: "Portfolio 0件",
    emptyMessage: "まず1つプロジェクトを作成して下さい",
    heading: "複数案件の危険箇所を横断で確認",
    copy: "project 単位で進捗、期限超過、次マイルストーン、直近7日変更数、risk を一覧できます。",
    summaryTitle: "Portfolio Summary",
    summaryCopy: "展開で主要 phase を確認し、行クリックで Project Detail へ移動します。",
    filterAll: "全案件",
    filterOverdue: "遅延中",
    filterWeekMilestone: "今週マイルストーン",
    assigneeBoardTitle: "担当者別タスク状況",
    assigneeBoardCopy: "担当者をクリックすると、担当プロジェクトだけに絞り込めます。",
    assigneeAll: "全担当",
    assigneeAllHelp: "担当者フィルタなし",
    assigneeSummary: (projectCount, open, overdue) => `${projectCount}件 / 未完了 ${open} / 遅延 ${overdue}`,
    emptyFiltered: "条件に合う project はありません",
  },
  roadmap: {
    emptyTitle: "Roadmap 0件",
    emptyMessage: "まず1つプロジェクトを作成して下さい",
    heading: "長期計画を月単位で俯瞰",
    copy: "project と主要 row を month bucket へ載せ、必要時だけ descendant を開いて年間 / FY の見通しを確認できます。",
    scaleYear: "年",
    scaleFy: "FY",
    filterAll: "全件",
    filterOverdue: "期限超過",
    filterMilestone: "マイルストーン",
    previousYear: "前年",
    nextYear: "次年",
    yearSpanLabel: "表示年数",
    yearSpanValue: (yearSpan) => `${yearSpan}年`,
    itemHeader: "項目",
    workloadLabel: "Workload",
    workloadTitle: "年間の月別負荷",
    workloadCopy: "表示中のタスクを月別に集計し、山になっている月を先に把握できます。",
    workloadPeople: (assigneeCount) => `${assigneeCount}人`,
    loading: "roadmap を読み込み中です",
    emptyFiltered: "条件に合う project / root item はありません",
  },
  settings: {
    label: "設定",
    heading: "主要設定",
    copy: "表示言語 / 週開始曜日 / FY開始月 / 稼働日 / 既定表示 を保存します。保存内容は再起動後も保持されます。",
    languageLabel: "表示言語",
    languageJa: "日本語",
    languageEn: "English",
    themeLabel: "テーマ",
    themeLight: "ライト",
    themeDark: "ダーク",
    autoBackupEnabledLabel: "自動バックアップ",
    autoBackupEnabledHelp: "起動時に local day あたり1回だけ auto backup を作成します。",
    autoBackupRetentionLabel: "保持件数",
    excelDefaultPriorityLabel: "優先度既定値",
    excelDefaultAssigneeLabel: "担当既定値",
    excelDefaultsHelp: "project export の MasterData に既定ヒントとして出力します。",
    weekStartsOnLabel: "週開始曜日",
    weekStartsOnMonday: "月曜始まり",
    weekStartsOnSunday: "日曜始まり",
    fyStartMonthLabel: "FY開始月",
    workingDaysLegend: "稼働日",
    workingDaysHelp: "dependency 自動後ろ倒しの next working day 計算に使います。",
    defaultViewLabel: "既定表示",
    save: "設定を保存",
    followUpLabel: "Follow-up",
    followUpHeading: "次の slice で追加する設定",
    autoBackup: "自動バックアップ設定",
    excelDefaults: "Excel テンプレート既定値",
  },
  searchFilter: {
    toolbarLabel: "Search / Filter",
    openButton: "Search / Filter",
    clearButton: "Clear",
    noActiveFilters: "current view に適用される条件はまだありません。",
    titleHome: "Home / Today の current view を絞り込み",
    titlePortfolio: "Portfolio の current view を絞り込み",
    titleRoadmap: "Year / FY Roadmap の current view を絞り込み",
    titleProject: "Project Detail の current view を絞り込み",
    drawerLabel: "Search / Filter Drawer",
    drawerTitle: "current view を絞り込みます",
    drawerCopy: "Portfolio は `portfolio_id`、年間表示対象のみ は roadmap eligible row を基準に判定します。",
    closeButton: "閉じる",
    keywordLabel: "全文",
    keywordPlaceholder: "タイトル / メモ / project 名",
    projectLabel: "プロジェクト",
    allOption: "すべて",
    portfolioLabel: "Portfolio",
    statusLabel: "状態",
    priorityLabel: "優先度",
    tagLabel: "タグ",
    tagPlaceholder: "例: 営業",
    assigneeLabel: "担当",
    assigneePlaceholder: "例: 田中",
    overdueOnly: "期限超過のみ",
    milestoneOnly: "マイルストーンのみ",
    roadmapOnly: "年間表示対象のみ",
    chipKeyword: "全文",
    chipProject: "Project",
    chipPortfolio: "Portfolio",
    chipStatus: "状態",
    chipPriority: "優先度",
    chipTag: "タグ",
    chipAssignee: "担当",
  },
  importPreview: {
    heading: "Excel Import Preview",
    selectedWorkbook: "選択済み workbook",
    apply: "適用",
    close: "閉じる",
    policyNote: "Browser fallback では DependsOn は preview / validation のみで、適用時には反映しません。",
    warningSummaryHeading: "Warning Summary",
    warningSummaryCopy: "適用前に確認したい warning 行を先にまとめています。",
    warningOnlyHeading: "Warning-only Table",
    warningOnlyCopy: "warning を持つ row だけを横並びで比較できます。",
    filterAll: "全件",
    filterWarning: "Warning",
    filterError: "Error",
    emptyAll: "preview 対象の行はありません",
    emptyWarning: "warning に一致する行はありません",
    emptyError: "error に一致する行はありません",
    rowLabel: "Row",
    actionLabel: "Action",
    projectLabel: "Project",
    titleLabel: "Title",
    validationLabel: "Validation",
    fieldLabel: "Field",
    beforeLabel: "Before",
    afterLabel: "After",
    compareOpen: "差分",
    compareClose: "差分を閉じる",
  },
  recovery: {
    label: "Recovery",
    heading: "起動に失敗したため recovery mode で開いています",
    copy: "DB の初期化または bootstrap に失敗しました。recent backup を確認し、必要なら restore して通常 workspace へ戻してください。",
    recentBackupsLabel: "Recent Backups",
    candidatesHeading: "復旧候補",
    noBackups: "利用可能な backup はありません。",
  },
  backupPreview: {
    heading: "Restore Preview",
    copy: "backup snapshot の内容だけを確認します。まだ current DB は変更しません。",
    close: "閉じる",
    projectsLabel: "Projects",
    itemsLabel: "Items",
    updatedLabel: "Updated",
    fileLabel: "File",
    createdLabel: "Created",
    sizeLabel: "Size",
    restoreDisabledNote: "recovery mode では preview のみ利用できます。復元実行は後続 slice で対応します。",
    confirmHeading: "この backup を current state に戻します。",
    confirmCopy: "desktop では restore 前に safety backup を自動作成します。",
    cancel: "キャンセル",
    restore: "Restore",
    afterRestoreNote: "restore 後は app state を再読込し、safety backup から再度戻せます。",
  },
};

const EN_COPY: UiCopy = {
  sidebar: {
    workspaceLabel: "Workspace",
    copy: "Home, Inbox, and Quick Capture are available while keeping the minimum Project Detail CRUD loop intact.",
    nav: {
      home: "Home / Today",
      portfolio: "Portfolio",
      roadmap: "Year / FY",
      project: "Project Detail",
      settings: "Settings",
    },
    projectNameLabel: "Project Name",
    projectNamePlaceholder: "Example: Core refresh",
    codeLabel: "Code",
    codePlaceholder: "Example: PRJ-001",
    createProject: "Create Project",
    emptyProjects: "Create your first project to get started.",
    projectListLabel: "Projects",
    projectListCollapsed: "Show",
    projectListExpanded: "Collapse",
    projectSearchPlaceholder: "Search projects",
    projectCount: (visible, total) => `${visible} / ${total}`,
    dataProtectionLabel: "Data Protection",
    localBackups: "Local Backups",
    autoBackupPolicy: "Auto: once per local day on startup / keep 7 auto backups",
    backupNow: "Backup now",
    textGitBackup: "Text Git backup",
    noBackups: "No backups yet.",
    restorePreview: "Restore Preview",
  },
  project: {
    headerLabel: "Project Detail",
    nameLabel: "Name",
    codeLabel: "Code",
    ownerLabel: "Main owner",
    ownerPlaceholder: "Example: Sato",
    totalTasks: "Total Tasks",
    openTasks: "Open",
    completedTasks: "Done",
    progress: "Progress",
    timeline: "Date-based Gantt",
    timelineDay: "1 day",
    timelineWeek: "Week",
    timelineMonth: "Month",
    timelineKeyboardHint: "The Gantt chart is date-based. Use Alt+Left/Right to move by one day and Alt+Shift+Left/Right to resize the right edge by one day.",
    wbsTree: "WBS Tree",
    wbsTreeCopy: "Use this grid to edit hierarchy, priority, assignee, dates, and tags.",
    importWorkbook: "Excel Import",
    exportWorkbook: "Excel Export",
    templates: "Templates",
    templatePanelHeading: "Template Library",
    templatePanelCopy: "Use saved templates to extend the current project or create a new project.",
    wbsTemplates: "WBS Templates",
    wbsTemplatesCopy: "Append the saved subtree to the current project's root level.",
    saveWbsTemplate: "Save selected root",
    saveWbsTemplateHelp: "Save the selected root row as a WBS template.",
    saveWbsTemplateDisabled: "Select a root row to save a WBS template.",
    projectTemplates: "Project Templates",
    projectTemplatesCopy: "Create and open a new project from the saved template.",
    saveProjectTemplate: "Save current project",
    saveProjectTemplateHelp: "Save the current project as a project template.",
    templateUpdatedAt: "Updated",
    applyWbsTemplate: "Apply to current project",
    applyProjectTemplate: "Create project",
    emptyTemplates: "No templates yet.",
    addRootRow: "Add Root Row",
    quickAddLabel: "Quick task add",
    quickAddTitle: "Add a task under this project",
    quickAddPlaceholder: "Example: Requirements review",
    quickAddButton: "Add Task",
    teamSummaryLabel: "Team",
    teamSummaryTitle: "Assignee status",
    teamSummaryCopy: "Summarizes the main owner and task assignees. Click a person to filter this project.",
    mainOwnerBadge: "main",
    noAssignees: "No assignees yet.",
    assigneeSummary: (open, done, overdue) => `Open ${open} / Done ${done} / Overdue ${overdue}`,
    bulkAddLabel: "Bulk subtask add",
    bulkAddChildTitle: "Add multiple rows under the selected row",
    bulkAddRootTitle: "Add multiple rows under this project",
    bulkAddRootHelp: "Select a row to add these as subtasks under it.",
    bulkAddPlaceholder: "Example:\nRequirements\nDesign review\nEstimate\nReview\nFixes\nApproval\nRelease prep",
    bulkAddButton: "Add Rows",
    eventDayLabel: "Add event day",
    eventDayChildTitle: "Add an event day under the selected row",
    eventDayRootTitle: "Add an event day under this project",
    eventDayRootHelp: "Select a row to register the event under it.",
    eventDayTitleLabel: "Event name",
    eventDayTitlePlaceholder: "Example: Customer review day",
    eventDayDateLabel: "Event date",
    eventDayButton: "Add Event",
    emptyFilteredRows: "No rows match the current filter.",
    emptyTreeRows: "Start from the minimum CRUD flow that creates parent, child, and grandchild rows.",
    emptyTimelineRows: "Rows with dates appear here.",
  },
  home: {
    heading: "Add what you need to do today in one line",
    copy: "Examples: Submit estimate 4/25 #sales @me / Design review 4/28 15:00 60m",
    placeholder: "Type a task. Example: Submit estimate 4/25 #sales @me",
    add: "Add",
    weekMilestonesMetric: "Week MS",
    inboxSubtitle: "Unscheduled tasks",
    today: "Today",
    todaySubtitle: "Tasks touching today",
    overdue: "Overdue",
    overdueSubtitle: "Risk hotspots",
    postpone: "Bulk postpone",
    postponeToday: "Move to Today",
    postponeTomorrow: "Move to Tomorrow",
    postponeWeekEnd: "Move to Week End",
    weekMilestones: "This Week's Milestones",
    weekMilestonesSubtitle: "Upcoming checkpoints",
    recentProjects: "Recently Updated Projects",
    recentProjectsCopy: "Click a project row to open Project Detail.",
    recentProgress: "Progress",
    inboxTemplateConversion: "Convert to Template",
    inboxTemplateConversionHelp: "Create a draft project and open Templates.",
    inboxEmpty: "No unscheduled items right now.",
    todayEmpty: "Nothing is scheduled for today.",
    overdueEmpty: "No overdue tasks.",
    weekMilestonesEmpty: "No milestones this week.",
    recentProjectsEmpty: "Create your first project to get started.",
  },
  portfolio: {
    emptyTitle: "No Portfolio Projects",
    emptyMessage: "Create your first project to get started.",
    heading: "Review risk across multiple projects",
    copy: "See progress, overdue count, next milestone, recent changes, and risk level per project.",
    summaryTitle: "Portfolio Summary",
    summaryCopy: "Expand key phases and click a row to open Project Detail.",
    filterAll: "All Projects",
    filterOverdue: "Overdue",
    filterWeekMilestone: "This Week's Milestones",
    assigneeBoardTitle: "Assignee Task Status",
    assigneeBoardCopy: "Click a person to filter the portfolio to their projects.",
    assigneeAll: "All assignees",
    assigneeAllHelp: "No assignee filter",
    assigneeSummary: (projectCount, open, overdue) => `${projectCount} projects / Open ${open} / Overdue ${overdue}`,
    emptyFiltered: "No projects match the current filter.",
  },
  roadmap: {
    emptyTitle: "No Roadmap Projects",
    emptyMessage: "Create your first project to get started.",
    heading: "Review long-range plans by month",
    copy: "Projects and key rows are placed into month buckets, and descendants can be expanded only when needed.",
    scaleYear: "Year",
    scaleFy: "FY",
    filterAll: "All",
    filterOverdue: "Overdue",
    filterMilestone: "Milestones",
    previousYear: "Previous",
    nextYear: "Next",
    yearSpanLabel: "Years shown",
    yearSpanValue: (yearSpan) => `${yearSpan} years`,
    itemHeader: "Item",
    workloadLabel: "Workload",
    workloadTitle: "Monthly workload across the year",
    workloadCopy: "Counts visible scheduled tasks by month so heavy months stand out before rescheduling.",
    workloadPeople: (assigneeCount) => `${assigneeCount} people`,
    loading: "Loading roadmap...",
    emptyFiltered: "No projects or root items match the current filter.",
  },
  settings: {
    label: "Settings",
    heading: "Core Preferences",
    copy: "Save language, week start, fiscal year start, working days, and default view. Changes persist after restart.",
    languageLabel: "Language",
    languageJa: "Japanese",
    languageEn: "English",
    themeLabel: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    autoBackupEnabledLabel: "Auto Backup",
    autoBackupEnabledHelp: "Create at most one auto backup per local day on startup.",
    autoBackupRetentionLabel: "Retention",
    excelDefaultPriorityLabel: "Default Priority",
    excelDefaultAssigneeLabel: "Default Assignee",
    excelDefaultsHelp: "Export these values as workbook hints in MasterData.",
    weekStartsOnLabel: "Week Starts On",
    weekStartsOnMonday: "Monday",
    weekStartsOnSunday: "Sunday",
    fyStartMonthLabel: "FY Start Month",
    workingDaysLegend: "Working Days",
    workingDaysHelp: "Used by dependency auto-shift when resolving the next working day.",
    defaultViewLabel: "Default View",
    save: "Save Settings",
    followUpLabel: "Follow-up",
    followUpHeading: "Settings planned for the next slice",
    autoBackup: "Auto Backup Settings",
    excelDefaults: "Excel Template Defaults",
  },
  searchFilter: {
    toolbarLabel: "Search / Filter",
    openButton: "Search / Filter",
    clearButton: "Clear",
    noActiveFilters: "No filters are currently applied to this view.",
    titleHome: "Filter the current Home / Today view",
    titlePortfolio: "Filter the current Portfolio view",
    titleRoadmap: "Filter the current Year / FY Roadmap view",
    titleProject: "Filter the current Project Detail view",
    drawerLabel: "Search / Filter Drawer",
    drawerTitle: "Filter the current view",
    drawerCopy: "Portfolio matches against `portfolio_id`, and roadmap-only matches rows that are eligible for roadmap display.",
    closeButton: "Close",
    keywordLabel: "Keyword",
    keywordPlaceholder: "Title / note / project name",
    projectLabel: "Project",
    allOption: "All",
    portfolioLabel: "Portfolio",
    statusLabel: "Status",
    priorityLabel: "Priority",
    tagLabel: "Tag",
    tagPlaceholder: "Example: sales",
    assigneeLabel: "Assignee",
    assigneePlaceholder: "Example: Tanaka",
    overdueOnly: "Overdue only",
    milestoneOnly: "Milestones only",
    roadmapOnly: "Roadmap-eligible only",
    chipKeyword: "Keyword",
    chipProject: "Project",
    chipPortfolio: "Portfolio",
    chipStatus: "Status",
    chipPriority: "Priority",
    chipTag: "Tag",
    chipAssignee: "Assignee",
  },
  importPreview: {
    heading: "Excel Import Preview",
    selectedWorkbook: "Selected workbook",
    apply: "Apply",
    close: "Close",
    policyNote: "In browser fallback, DependsOn is previewed and validated but is not applied during commit.",
    warningSummaryHeading: "Warning Summary",
    warningSummaryCopy: "Rows with warnings are collected here first so they can be reviewed before apply.",
    warningOnlyHeading: "Warning-only Table",
    warningOnlyCopy: "Compare only the rows that currently contain warnings.",
    filterAll: "All",
    filterWarning: "Warning",
    filterError: "Error",
    emptyAll: "No preview rows are available.",
    emptyWarning: "No rows match the warning filter.",
    emptyError: "No rows match the error filter.",
    rowLabel: "Row",
    actionLabel: "Action",
    projectLabel: "Project",
    titleLabel: "Title",
    validationLabel: "Validation",
    fieldLabel: "Field",
    beforeLabel: "Before",
    afterLabel: "After",
    compareOpen: "Compare",
    compareClose: "Hide Compare",
  },
  recovery: {
    label: "Recovery",
    heading: "Startup failed, so the app opened in recovery mode",
    copy: "Database initialization or bootstrap failed. Review recent backups and restore one if needed to return to the normal workspace.",
    recentBackupsLabel: "Recent Backups",
    candidatesHeading: "Recovery Candidates",
    noBackups: "No backups are currently available.",
  },
  backupPreview: {
    heading: "Restore Preview",
    copy: "Review the backup snapshot only. The current database is not changed yet.",
    close: "Close",
    projectsLabel: "Projects",
    itemsLabel: "Items",
    updatedLabel: "Updated",
    fileLabel: "File",
    createdLabel: "Created",
    sizeLabel: "Size",
    restoreDisabledNote: "Recovery mode currently allows preview only. Restore execution is handled in a later slice.",
    confirmHeading: "This backup will replace the current state.",
    confirmCopy: "On desktop, a safety backup is created automatically before restore.",
    cancel: "Cancel",
    restore: "Restore",
    afterRestoreNote: "After restore, the app state reloads and you can return again from the safety backup.",
  },
};

const UI_COPY_BY_LANGUAGE: Record<AppLanguage, UiCopy> = {
  ja: JA_COPY,
  en: EN_COPY,
};

const WORKING_DAY_LABELS: Record<AppLanguage, Record<WorkingDayNumber, string>> = {
  ja: {
    0: "日曜",
    1: "月曜",
    2: "火曜",
    3: "水曜",
    4: "木曜",
    5: "金曜",
    6: "土曜",
  },
  en: {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  },
};

export function getUiCopy(language: AppLanguage): UiCopy {
  return UI_COPY_BY_LANGUAGE[language];
}

export function getWorkingDayOptions(language: AppLanguage): Array<{
  value: WorkingDayNumber;
  label: string;
}> {
  return [1, 2, 3, 4, 5, 6, 0].map((value) => ({
    value,
    label: WORKING_DAY_LABELS[language][value as WorkingDayNumber],
  }));
}

export function getDefaultViewLabel(
  language: AppLanguage,
  value: AppDefaultView
): string {
  if (value === "home") {
    return UI_COPY_BY_LANGUAGE[language].sidebar.nav.home;
  }
  if (value === "portfolio") {
    return UI_COPY_BY_LANGUAGE[language].sidebar.nav.portfolio;
  }
  return UI_COPY_BY_LANGUAGE[language].sidebar.nav.roadmap;
}

export function getThemeLabel(language: AppLanguage, value: AppTheme): string {
  const settingsCopy = UI_COPY_BY_LANGUAGE[language].settings;
  return value === "dark" ? settingsCopy.themeDark : settingsCopy.themeLight;
}

export function getAutoBackupPolicyText(
  language: AppLanguage,
  enabled: boolean,
  retentionLimit: number
): string {
  if (language === "ja") {
    return enabled
      ? `自動: 起動時に日次1回 / auto ${retentionLimit}件保持`
      : `自動: 無効 / manual と safety backup は保持`;
  }

  return enabled
    ? `Auto: once per local day on startup / keep ${retentionLimit} auto backups`
    : "Auto: disabled / manual and safety backups stay available";
}

export function formatMonthLabel(language: AppLanguage, month: number): string {
  return language === "ja" ? `${month}月` : month.toString();
}
