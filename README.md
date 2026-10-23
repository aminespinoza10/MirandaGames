# MirandaGames
En este repo vamos a subir los juegos que iremos haciendo Miranda y yo

## Games

| Game | Folder | Play |
| --- | --- | --- |
| Happy Game | [`games/happy-game`](games/happy-game/README.md) | <http://192.168.68.77/happy-game/> (home network) |

Each game is a static web page in its own folder under `games/`. See the game's README for how to run it locally,
run its tests and customize its art and sounds.

## Deploying

Games are published to the nginx server at `192.168.68.77`, where each one lives at `http://192.168.68.77/<game>/`.
nginx doesn't need any configuration: its default site already serves `/var/www/html`.

```bash
./scripts/deploy.sh <game>      # e.g. ./scripts/deploy.sh happy-game
```

The script runs the game's tests (and stops if any fail), uploads the game with `rsync` over SSH, then checks the page
and the asset manifest are served and that the server has the new build. It never uses `sudo` and never asks for a password.

### One-time setup per game

The web root belongs to root, so each game needs its own folder created once. Run this (it asks for your sudo password):

```bash
ssh -t -i ~/.ssh/id_home_ubuntu aminespinoza@192.168.68.77 \
  "sudo mkdir -p /var/www/html/<game> && sudo chown aminespinoza: /var/www/html/happygame"
```

If you forget, the deploy script stops and prints this exact command for you.

### Settings

The defaults are in `scripts/deploy.sh`. To change them, copy `deploy.env.example` to `deploy.env` (gitignored) and edit it,
or set environment variables for a single run (they win over `deploy.env`):

```bash
DEPLOY_HOST=192.168.68.80 ./scripts/deploy.sh happy-game
```

| Variable | Default |
| --- | --- |
| `DEPLOY_HOST` | `192.168.68.77` |
| `DEPLOY_USER` | `aminespinoza` |
| `DEPLOY_KEY` | `~/.ssh/id_home_ubuntu` |
| `DEPLOY_WEBROOT` | `/var/www/html` |
| `DEPLOY_URL` | `http://$DEPLOY_HOST` |

### Troubleshooting

- **`could not SSH to …`**: check the server is on, then test key login with
  `ssh -i ~/.ssh/id_home_ubuntu aminespinoza@192.168.68.77`. If it asks for a password, the key isn't set up:
  run `ssh-copy-id -i ~/.ssh/id_home_ubuntu aminespinoza@192.168.68.77`.
- **`… doesn't exist on the server or … can't write to it`**: do the one-time setup above.
- **`tests failed; nothing was deployed`**: run `npm test` in the game folder to see which test failed.
- **The server's IP changed**: set `DEPLOY_HOST` in `deploy.env`. Reserving the IP in your router avoids this.
- **The old art still shows after a deploy**: this shouldn't happen, because every deploy changes the asset URLs.
  If it does, check the deploy ended with `Deployed:` and that `http://192.168.68.77/<game>/build.json` shows the new build.
