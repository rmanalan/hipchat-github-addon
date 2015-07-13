/* add-on script */
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
app.factory('repoService',
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
                    },
                    search: {
                        url: '/repos/search',
                        method: 'GET',
                        isArray: false
                    }
                }
            );
        }
    ]
);
app.controller('MainCtrl',
    [
        '$scope',
        'repoService',
        function($scope, Repo){
        	$scope.githubLogin = true;
        	$scope.enterpriseDetail = {}
        	$scope.error = {};
            $scope.repoName = '';
            $scope.subscribedRepos = Repo.all();
            dialog.resize('100%', '1000px'); // 1000px hack is because we're in a dialog
                        
            $scope.login = function(token){
				var url = '/auth/github?signed_request=' + token;
				if (! $scope.githubLogin){
					url = '/auth/github-enterprise?signed_request=' + token + 
							"&domain=" + $scope.enterpriseDetail.domain + '&access_token=' + $scope.enterpriseDetail.accessToken;
				}
				var newWindow = window.open(url, 'name', 'height=768,width=1024');
				if (window.focus) {
					newWindow.focus();
				}
				return false;
            }
            
            $scope.enterpriseLogin = function(){
            	$scope.githubLogin = true;
            }
            
            $scope.getLogin = function(){
            	$scope.githubLogin = false;
            }
            
            $scope.repoNameValid = function(repoName){
                return /\//.test(repoName);
            }

            $scope.subscribe = function(repoName){
                angular.element(document.querySelector('#add-repo')).removeClass('aui-iconfont-add').addClass('aui-icon-wait');
                $scope.error = {};
                if (!$scope.repoNameValid(repoName)) { return false; }
                var subscription = new Repo({repoName: repoName});
                subscription.$save().then(function(repo){
                    $scope.repoName = '';
                    $scope.subscribedRepos.push(repo);
                    dialog.resize('100%', '1000px');
                    angular.element(document.querySelector('#add-repo')).addClass('aui-iconfont-add').removeClass('aui-icon-wait');
                }).catch(function(err){
                    $scope.error.title = err.data.title || 'Repository error';
                    $scope.error.msg = err.data.msg || 'Repository named ' + repoName + ' ' + err.data.message;
                    angular.element(document.querySelector('#add-repo')).addClass('aui-iconfont-add').removeClass('aui-icon-wait');
                });
                return false;
            }

            $scope.updateSubscription = function(repo){
                $scope.error = {};
                Repo.update({id: repo.id}, repo);
            }

            $scope.unsubscribe = function(){
                $scope.error = {};
                var idx = $scope.subscribedRepos.map(function(a) { return a.id; }).indexOf(this.repo.id);
                $scope.subscribedRepos.splice(idx, 1);
                dialog.resize();
                Repo.remove({id: this.repo.id});
            }

            $scope.showConfig = function(){
                $scope.error = {};
                angular.element(document.querySelectorAll('.repo-config')).addClass('hidden');
                angular.element(document.querySelector('#repo-config-'+this.$index)).removeClass('hidden');
                dialog.resize('100%', '1000px');
                return false;
            }

            $scope.hideConfig = function(){
                $scope.error = {};
                angular.element(document.querySelector('#repo-config-'+this.$index)).addClass('hidden');
                dialog.resize();
                return false;
            }

            function debounce(func, wait, immediate) {
                var timeout, args, context, timestamp, result;
                return function() {
                    context = this;
                    args = arguments;
                    timestamp = new Date();
                    var later = function() {
                        var last = (new Date()) - timestamp;
                        if (last < wait) {
                            timeout = setTimeout(later, wait - last);
                        } else {
                            timeout = null;
                            if (!immediate) result = func.apply(context, args);
                        }
                    };
                    var callNow = immediate && !timeout;
                    if (!timeout) {
                        timeout = setTimeout(later, wait);
                    }
                    if (callNow) result = func.apply(context, args);
                    return result;
                };
            };
            $scope.search = debounce(function(name){
                if (name.length < 4) { return; }
                angular.element(document.querySelector('#add-repo')).removeClass('aui-iconfont-add').addClass('aui-icon-wait');
                $scope.searchResults = Repo.search({q: name}, function(){
                    angular.element(document.querySelector('#add-repo')).addClass('aui-iconfont-add').removeClass('aui-icon-wait');
                });
            }, 400);

            $scope.selectResult = function(){
                $scope.repoName = this.result.name;
                angular.element(document.querySelector('.repo-results')).addClass('hidden');
            }
        }
    ]
);
