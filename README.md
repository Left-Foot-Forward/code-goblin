<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/card-dark.svg">
  <img alt="Hoard: the org's code goblin, its level, this month's goal and shout-outs" src="docs/card.svg" width="100%">
</picture>

<!-- goblin:links -->
**▶ Play the game** · Feed · Pet · Cheer (links appear after the first Feast run)
<!-- /goblin:links -->

# Hoard

**A clicker game your whole organisation plays by shipping.** Every pull request your org merges feeds a shared code goblin. It grows, levels up and gains accessories as the team ships, and everyone who plays gets stronger when the org hits its goals.

It lives entirely on GitHub:

| Piece | Where it runs |
| --- | --- |
| The card above | Redrawn by a GitHub Action every 6 hours from the org's real merged PRs |
| The game | GitHub Pages, straight from `docs/` |
| Feed, pet, cheer | Issues: open one from the links above and a bot replies, counts it and closes it |

## How the goblin eats

- **Merged pull requests are meals.** Each one arrives in the game as a scroll anyone can feed to the goblin, with the author and title on it.
- **Deleted lines are the best flavour.** Deletions mint gold, which buys permanent relics. Cleaning up is rewarded, not just adding.
- **The team sets the pace.** The org's level comes from all-time merged PRs, and each month has a feast goal (110% of last month). The org's level and goal progress multiply everything every player earns.
- **People get shout-outs, not rankings.** Top feeder, cleanup hero, review sage and fresh faces making their first merge. Bots and AI reviewers count toward the totals but never take a shout-out.

In the game you tap the goblin to write code, hire a crew (a linter imp, a rubber duck, an intern, a legacy dragon…), pass builds, survive flaky tests, resolve surprise merge conflicts and eventually squash and merge your history for permanent bonuses. Personal progress saves in your browser. The org's hoard is shared.

## Set it up for your organisation

1. Click **Use this template** and create the repo inside your org (public, so Pages and the card work on any plan).
2. **Settings → Pages**: deploy from the `main` branch, `/docs` folder.
3. **Settings → Actions → General → Workflow permissions**: choose *Read and write*.
4. **Actions → Feast → Run workflow.** The goblin eats for the first time, and the README links point at your repo.
5. Optional: show the card on your org's profile by adding this to `.github/profile/README.md` in your org's `.github` repo:

   ```html
   <a href="https://YOUR-ORG.github.io/YOUR-REPO/"><img src="https://raw.githubusercontent.com/YOUR-ORG/YOUR-REPO/main/docs/card.svg" alt="Our code goblin"></a>
   ```

Settings live in [`goblin.config.json`](goblin.config.json):

| Key | Default | What it does |
| --- | --- | --- |
| `org` | repo owner | Which org (or user) to feed on |
| `name` | `Grub` | The goblin's name |
| `windowDays` | `90` | How far back the feast looks for scrolls and shout-outs |
| `repos` | all | Limit to some repos, e.g. `["api", "web"]` |
| `showPrivateTitles` | `false` | Leave this off unless the game is private too |

## Privacy

With the default `GITHUB_TOKEN`, the goblin only sees **public** repositories. To count private work too, add a read-only token as the `GOBLIN_TOKEN` repository secret: a fine-grained token with *Pull requests: read* on the org's repos. Private pull requests then count toward the org's totals and goals, but appear only as **sealed scrolls**. No title, repo, link or author is ever published, and private contributors are never named in shout-outs.

## Run it locally

```bash
node scripts/feast.mjs --demo                       # sample data, no network
GITHUB_TOKEN=$(gh auth token) node scripts/feast.mjs --org your-org
python3 -m http.server 8790 --directory docs        # then open http://localhost:8790
```

No dependencies: Node 20+ and a static file server are all it needs.
