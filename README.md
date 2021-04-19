# Recoll WE Browser Extension for Google Chrome, Using A Web Service

The [Recoll WE Firefox extension](https://addons.mozilla.org/en-US/firefox/addon/recoll-we/) "indexes Firefox visited pages with [Recoll](https://www.lesbonscomptes.com/recoll/)."   The extension does this by downloading temporary copies of each web page visited which the Recoll indexing engine then periodically processes and deletes.

The problem this version of the extension tries to solve is that the existing process results in two files being added to the browser's downloads menu and progress bar for every web page visited.  This process is somewhat "noisy" and I'd prefer it to be more invisible.   In this version of the extension I have changed the process so that the extension now sends the content of each web page visited to a local web service.  That web service then writes to disk the two files that the Recoll indexing engine needs.  From there indexing by the Recoll indexing engine continues as it normally would.  Using this method avoids adding anything to the browser's download list or to the download progress bar.  The process is now essentially invisible.

To use this method, my version of the extension must be installed into the browser and the web service, a python script, must be running in the background on the workstation.  Download the <code>recoll-we-using-webservice.crx</code> and <code>recoll-we-webservice.py</code> from this project.

The Python script is run on the workstation under your userid, it is not a system-wide service.  To run it do:

<pre>FLASK_APP=/path/to/recoll-we-webservice.py python -m flask run &</pre>

Add the <code>-p ####</code> option after <code>run</code> to use a port other than 5000 for the web service.  A corresponding option has been added to the extension's settings page to tell the extension what port number it should use. 

I use Fedora Linux.  On Fedora, <code>dnf install python3-flask</code> installs the required [Flask web framework](https://flask.palletsprojects.com/) module.

The web service script writes a log file at /tmp/recoll-we-webservice.log.  It rotates that log file automatically.
