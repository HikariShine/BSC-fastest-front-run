osascript -e 'tell application "Terminal" to activate' \
  -e 'tell application "Terminal" to do script "npm run listenPending"' \
  -e 'tell application "Terminal" to do script "python3 manage.py runserver 127.0.0.1:8000"'


