/* add-on script */
function poptastic(url) {
    var newWindow = window.open(url, 'name', 'height=768,width=1024');
    if (window.focus) {
        newWindow.focus();
    }
}

var dialog;
HipChat.require('env', function(env){
    dialog = env;
    dialog.resize();
});

var app = angular.module('GitHub',['ngResource']);

app.config(
    [
        '$httpProvider',
        '$interpolateProvider',
        function($httpProvider, $interpolateProvider){
            $interpolateProvider.startSymbol('[[').endSymbol(']]');
            $httpProvider.interceptors.push(function() {
                return {
                    'response': function(response) {
                        // Refresh to token
                        ACPT = response.headers('x-acpt');
                        return response;

                    }
                };
            });
            $httpProvider.defaults.headers.common = {
                'x-acpt': ACPT
            };
        }
    ]
);
app.factory('subscriptionService',
    [
        '$resource',
        function($resource){
            return $resource('/repos', {},
                {
                    add: {
                        method: 'POST',
                        isArray: false
                    },
                    update: {
                        url: '/repos/:id',
                        method: 'PUT',
                        isArray: false
                    },
                    remove: {
                        url: '/repos/:id',
                        method: 'DELETE',
                        isArray: false,
                    },
                    all: {
                        method: 'GET',
                        isArray: true
                    }
                }
            );
        }
    ]
);
app.controller('MainCtrl',
    [
        '$scope',
        'subscriptionService',
        function($scope, Subscription){
            $scope.error = {};
            $scope.repoName = '';
            $scope.subscribedRepos = Subscription.all();

            $scope.repoNameValid = function(repoName){
                return /\//.test(repoName);
            }

            $scope.subscribe = function(repoName){
                $scope.error = {};
                if (!$scope.repoNameValid(repoName)) { return false; }
                var subscription = new Subscription({repoName: repoName});
                subscription.$save().then(function(repo){
                    $scope.repoName = '';
                    $scope.subscribedRepos.push(repo);
                    dialog.resize();
                }).catch(function(err){
                    $scope.error.title = 'Repository error';
                    $scope.error.msg = 'Repository named ' + repoName + ' ' + err.data.message;
                });
                return false;
            }

            $scope.updateSubscription = function(repo){
                $scope.error = {};
                Subscription.update({id: repo.id}, repo);
            }

            $scope.unsubscribe = function(){
                $scope.error = {};
                var idx = $scope.subscribedRepos.map(function(a) { return a.id; }).indexOf(this.repo.id);
                $scope.subscribedRepos.splice(idx, 1);
                Subscription.remove({id: this.repo.id});
            }

            $scope.showConfig = function(){
                $scope.error = {};
                angular.element(document.querySelectorAll('.repo-config')).addClass('hidden');
                angular.element(document.querySelector('#repo-config-'+this.$index)).removeClass('hidden');
                return false;
            }

            $scope.hideConfig = function(){
                $scope.error = {};
                angular.element(document.querySelector('#repo-config-'+this.$index)).addClass('hidden');
                return false;
            }
        }
    ]
);
