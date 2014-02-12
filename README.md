# GitHub for HipChat Add-on

This add-on allows your team to get notified of events that happen on GitHub inside your HipChat rooms. Built using [atlassian-connect-express-hipchat](https://bitbucket.org/hipchat/atlassian-connect-express-hipchat).

## Running on your own server

To run this on your own server, you'll need to [register a GitHub Application](https://github.com/settings/applications/new). GitHub will issue you with a *Client ID* and a *Client Secret*. You'll need both to run this add-on:

    AC_LOCAL_BASE_URL=https://<your-add-on-host> GH_ID=<GitHub Client ID> GH_SECRET=<GitHub Client Secret> NODE_ENV=production node app.js

If you're curious about how this is built, take a look at [atlassian-connect-express-hipchat](https://bitbucket.org/hipchat/atlassian-connect-express-hipchat).