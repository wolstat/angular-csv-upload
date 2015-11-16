# angular-csv-upload

Upload a CSV file of expense report purchases from an AngularJS form.

Sending one line at a time via an HTTP PUT endpoint is slower than all at once, but it allows the user to be alerted of which line caused the problem if the import fails.
