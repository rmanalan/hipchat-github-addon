/* add-on script */
function poptastic(url) {
    var newWindow = window.open(url, 'name', 'height=768,width=1024');
    if (window.focus) {
        newWindow.focus();
        // check_oauth();
    }
}
HipChat.require('env', function(env){
    env.resize();
});