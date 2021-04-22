#!/usr/bin/env python

#  Copyright (C) 2021  David King <dave@daveking.com>
#
#  This program is free software: you can redistribute it and/or modify
#  it under the terms of the GNU General Public License as published by
#  the Free Software Foundation, either version 3 of the License, or
#  (at your option) any later version.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License
#  along with this program.  If not, see <http://www.gnu.org/licenses/>.

#  See https://framagit.org/dlk3/recoll-we-using-webservice for information
#  about this script.

try:
	from flask import Flask
	from flask import request
except Exception as e:
	print("This script requires the Flask web application framework module.  Please use\nyour ditribution's package management tools to install it.")
	exit(1)
	
import os
import sys
import logging

try:
    from recoll import rclconfig
except:
    import rclconfig

#  Configure Flask application logging
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

# Get target webqueue recoll directory from recoll configuration file
config = rclconfig.RclConfig()
webqueuedir = config.getConfParam("webqueuedir")
if not webqueuedir:
    if sys.platform == "win32":
        webqueuedir = "~/AppData/Local/RecollWebQueue"
    else:
        webqueuedir = "~/.recollweb/ToIndex"
webqueuedir = os.path.expanduser(webqueuedir)
if not os.path.exists(webqueuedir):
	try:
		os.makedirs(webqueuedir)
	except Exception as e:
		msg = "Failed to create the \"{}\" directory. Error message: \"{}\"".format(webqueuedir, e)
		app.logger.error(msg)
		print(msg, file=sys.stderr)
		exit(1)

#  Define this as a Flask web service application
app = Flask(__name__)

#  Define the sole POST API supported by this Flask application
@app.route('/index', methods=['POST'])
def index():
	req = request.get_json()
	filename = os.path.join(webqueuedir, req['filename'])
	try:
		with open(filename, 'w') as f:
			f.write(req['content']);
	except Exception as e:
		msg = "Unable to write to the \"{}\" file. Error message: \"{}\"".format(filename, e)
		app.logger.error(msg)
		return msg, 400
	msg = "Data successfully written to {}".format(filename)
	app.logger.info(msg)
	return msg, 201

if __name__ == '__main__':
	app.run()
