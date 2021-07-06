cur_path=$(pwd)
echo $cur_path
osascript -e 'tell application "Terminal" to do script "cd /Users/jasonludwig/Downloads/front_run/Front-run-bot-MAC; npm run listenPending"'
osascript -e 'tell application "Terminal" to do script "cd /Users/jasonludwig/Downloads/front_run/Front-run-bot-MAC; python3 manage.py runserver 127.0.0.1:8000"'
osascript -e 'tell application "Terminal" to do script "open \"http://localhost:8000\""'

