rsync -avz -e "ssh -p 4561" --delete \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude 'data/leaderboard.csv' \
  /home/lukas/Documents/Projects/marketing_time_game/ \
  root@212.132.68.199:~/projects/rocket-game/