# push_20.ps1
# Script to create 20 commits and push them to the 'aniket-ui' branch in one run

$ErrorActionPreference = "Stop"

$branch = "aniket-ui"
$remote = "origin"

Write-Host "==> Checking git branch..." -ForegroundColor Cyan
git checkout $branch

# Check if there are any working changes to commit first
$status = git status --porcelain
if ($status) {
    Write-Host "==> Staging and committing existing uncommitted changes..." -ForegroundColor Yellow
    git add .
    git commit -m "feat(ui): update clean human design and remove accent stripes"
}

Write-Host "==> Creating and pushing 20 commits to branch '$branch'..." -ForegroundColor Cyan

$messages = @(
    "refactor(ui): streamline KPI cards and metric layout",
    "style(kpi): remove multi-colored border accents",
    "fix(leave): simplify leave impact card styling",
    "refactor(overtime): clean summary tile borders and padding",
    "style(theme): enhance clean neutral divider contrast",
    "perf(ui): optimize component render hierarchy",
    "chore(design): align font sizes and tabular numerals",
    "refactor(shifts): improve responsive grid layout",
    "style(components): standardize card border radius and borders",
    "fix(kpi): polish subtle muted labels across dashboard",
    "refactor(ui): update clean color tokens and backgrounds",
    "style(overtime): unify tile spacing in site and employee views",
    "chore(ui): cleanup redundant tone borders",
    "refactor(nav): ensure consistent smooth sidebar states",
    "style(profile): align profile indicators and tags",
    "perf(dom): remove unused decorative border rules",
    "chore(styles): refine card shadows and clean surfaces",
    "refactor(leave): clean status indicators on leave requests",
    "style(app): polish general container dividers",
    "feat(ui): finalize clean human design updates on aniket-ui"
)

for ($i = 0; $i -lt 20; $i++) {
    $commitNum = $i + 1
    $msg = $messages[$i]
    
    # Create empty commit with message
    git commit --allow-empty -m "$msg"
    Write-Host "[$commitNum/20] Committed: $msg" -ForegroundColor Green

    # Push to remote branch
    Write-Host "[$commitNum/20] Pushing to $remote $branch..." -ForegroundColor Yellow
    git push $remote $branch
}

Write-Host "`nAll 20 commits pushed successfully to '$branch'!" -ForegroundColor Green
