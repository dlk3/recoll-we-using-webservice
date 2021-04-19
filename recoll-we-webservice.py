#!/usr/bin/env python

from flask import Flask
from flask import request
import os
import logging

# Specify the default downloads folder configured in this user's Google Chrome browser
my_chrome_downloads_folder = os.path.join(os.environ['HOME'], 'Downloads')
# my_chrome_downloads_folder = '/home/userid/Downloads'

#  Configure application logging
from logging.config import dictConfig
dictConfig({
    'version': 1,
    'formatters': {'default': {
        'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
    }},
    'handlers': {__name__ + '_log': {
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': '/tmp/recoll-we-webservice.log',
        'maxBytes': 250000,
        'backupCount': 1,
        'formatter': 'default'
    }},
    'root': {
        'level': 'INFO',
        'handlers': [__name__ + '_log']
    }
})

#  Define the application
app = Flask(__name__)

#  Define the single POST API supported by this web service
@app.route('/index', methods=['POST'])
def index():
	req = request.get_json()
	filename = os.path.join(my_chrome_downloads_folder, req['filename'])
	dn, fn = os.path.split(filename)
	if not os.path.exists(dn):
		try:
			os.makedirs(dn)
		except Exception as e:
			msg = "Failed to create the \"{}\" directory. Error message: \"{}\"".format(dn, e)
			app.logger.error(msg)
			return msg, 400
	with open(filename, 'w') as f:
		f.write(req['content']);
	msg = 'Data successfully written to {}'.format(filename)
	app.logger.info(msg)
	return 'msg', 201

if __name__ == '__main__':
	app.run()
