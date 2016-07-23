#!/usr/bin/env node

'use strict';

var fs = require('fs');
var fse = require('fs-extra');
var HtmlWebpackPlugin = require('html-webpack-plugin');
//var extend = require('util')._extend;



/**
 * cope项目模板到当前工程目录
 */
var copyProject = function(params){
	var tragetPath  = fs.realpathSync('.');
	var sorcePath = __dirname;
	if (params.type == 's')
		sorcePath = sorcePath + '/tpl/s' ;
	else
		sorcePath = sorcePath + '/tpl/m' ;
	fse.copySync(sorcePath, tragetPath);
	var _package  = require(tragetPath + '/package.json');
	_package.name = params.name;
	_package.description = params.desc;
	fs.writeFileSync(tragetPath + '/package.json', JSON.stringify(_package, null,2), 'utf8');
	console.log('init success!');

};

/**
 * 同步工程到iweb_home中
 */
var syncModule = function(){
	var tragetPath = fs.realpathSync('.');
	var dirList = fs.readdirSync(tragetPath);
	dirList.forEach(function(project){
		if (fs.lstatSync(tragetPath + '/' + project).isFile()){
			return;
		}
		if (project === 'dist' || project === 'iweb_home'){
			return;
		}
		//业务组件
		var projectPath = tragetPath + '/' + project;
		fse.removeSync(tragetPath + '/iweb_home/modules/' + project);
		var compList = fs.readdirSync(projectPath);
		compList.forEach(function(compName){
			var compPath = projectPath + "/" + compName;
			//只有存在iweb.config.json文件，才会被做为组件
			if (fs.existsSync(compPath + '/iweb.config.js')){
				fse.copySync(compPath, tragetPath + '/iweb_home/modules/' + project + '/' + compName);
			}
		});
	});
};

/**
 * 清空dist目录
 */
var cleanDistDir = function(){
	var tragetPath = fs.realpathSync('.');
	if (!fs.existsSync(tragetPath + "/dist")){
		fs.mkdirSync(tragetPath + "/dist");
	}
	var distList = fs.readdirSync(tragetPath + "/dist");
	distList.forEach(function(item){
		fse.removeSync(tragetPath + "/dist/" + item);
	});
};

/**
 * 合并项目中的配置
 */
var mergeWebpackConfig = function(webpackConfig, iwebConfig,rootPath, moduleName, compName){
	var template,filename;

	if (iwebConfig.entry){
		for (var key in iwebConfig.entry){
			var _path = iwebConfig.entry[key];
			if (_path.indexOf('./') === 0){
				_path = _path.substring(2,_path.length);
			}
			if (!moduleName && !compName)
				webpackConfig.entry[key] =rootPath + "/" +_path;
			else
				webpackConfig.resolve.alias[moduleName + '.' + compName + '.' + key] = rootPath + '/'+ moduleName + '/' + compName + '/'+ _path;
		}
	}
	if (iwebConfig.entryHtmlFiles){
		var htmlPlugins = [];
		iwebConfig.entryHtmlFiles.forEach(function(entryHtmlFile){
			var template = entryHtmlFile.template;
			var filename = entryHtmlFile.filename;
			if (template.indexOf('./') === 0){
				template = template.substring(2,_path.length);
			}

			if (!moduleName && !compName){
				template = rootPath + '/'+ template;
				filename =   filename;
			}else{
				template = rootPath + '/'+ moduleName + '/' + compName + '/'+ template;
				filename = "../" +  moduleName + '/' + compName + '/'+ filename;
			}

			var plugin = new HtmlWebpackPlugin({
				template: template,
				filename: filename,
				webContext:'/' + iwebConfig['webContext']
			});


			htmlPlugins.push(plugin);
		});
		webpackConfig.plugins = webpackConfig.plugins.concat(htmlPlugins);
	}
};


/**
 * 获取webpack配置对象
 */
var getWebpackConfig = function(mode, moduleName){
	var tragetPath = fs.realpathSync('.');
	var iwebHome = tragetPath + "/iweb_home";
	var webpackConfigName = 'webpack.config';
	//build单一项目
	if (!fs.existsSync(iwebHome)){
		try {
			var webpackConfig = require(tragetPath + '/config/'+webpackConfigName).getConfig(mode);
		}catch (e){
			console.error(e)
		}
		var iwebConfigPath = tragetPath + "/config/iweb.config.js";
		//var _config = JSON.parse(fs.readFileSync(iwebConfigPath, 'utf8'));
		var _config =  require(iwebConfigPath); //JSON.parse(fs.readFileSync(iwebConfigPath, 'utf8'));
		mergeWebpackConfig(webpackConfig, _config, tragetPath);
	}
	//多模块项目
	else{
		var modulesPath = iwebHome + "/modules";
		var webpackConfigFunc = require(iwebHome + '/config/'+webpackConfigName);
		var modulePath = modulesPath + "/" + moduleName;
		var compList = fs.readdirSync(modulePath);
		//组织webpack配置文件
		var webpackConfig = webpackConfigFunc.getConfig(mode);
		//console.log(webpackConfig.entry);
		compList.forEach(function (compName) {
			var configPath = modulePath + "/" + compName + "/iweb.config.js";
			if (fs.existsSync(configPath)) {
				//var _config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
				var _config =  require(configPath); //JSON.parse(fs.readFileSync(configPath, 'utf8'));
				mergeWebpackConfig(webpackConfig, _config, modulesPath, moduleName, compName);
			}
		});


	}

	return webpackConfig;
}


var iweb = {};
//命令行
iweb.cli = {};

iweb.cli.init = function(){
	var _name = '';
	var _desc = '';
	process.stdout.write('project name:');
	process.stdin.resume();
	process.stdin.setEncoding('utf-8');
	process.stdin.once('data', function(name) {
		_name =  name.toString().trim();
		process.stdout.clearLine();
		process.stdout.cursorTo(0);

		process.stdout.write('description:');
		process.stdin.resume();
		process.stdin.once('data', function(desc) {
			_desc = desc.toString().trim();
			process.stdout.clearLine();
			process.stdout.cursorTo(0);

				copyProject({
					name:_name,
					desc:_desc,
					type:'s'//data
				});
				process.exit();
			//});
		});

	});

};


iweb.cli.build = function(mode){
	mode = mode || 'production';
	var tragetPath = fs.realpathSync('.');
	var iwebHome = tragetPath + "/iweb_home";
	var gulp=require('gulp');
	//清空dist目录
	cleanDistDir();

	//build单一项目
	if (!fs.existsSync(iwebHome)){
		var webpackConfig = getWebpackConfig(mode);
		var gulpConfig = require(tragetPath + '/config/gulp.config');
		gulpConfig(gulp, webpackConfig);
		gulp.start('default');
	}
	//多模块项目
	else{
		//同步当前模块工程到iwebhome中
		syncModule();
		var modulesPath = iwebHome + "/modules";

		var moduleList = fs.readdirSync(modulesPath);
		var gulpConfig = require(iwebHome + '/config/gulp.config');

		moduleList.forEach(function(moduleName){
			var webpackConfig = getWebpackConfig(mode);

			gulpConfig(gulp, webpackConfig);
			gulp.start('default');

		});
	}

};
iweb.cli.publish = function(){
	var targetPath = fs.realpathSync('.');
	var gulp=require('gulp');

	var webpackConfig = getWebpackConfig('production');
	var gulpConfig = require(targetPath + '/config/gulp.config');
	gulpConfig(gulp, webpackConfig);
	gulp.start('war');

	var iwebConfig = require(targetPath + '/config/iweb.config');
	var publishConfig = iwebConfig.publish; //require(targetPath + '/config/publish.config');

	var installCommandStr = publishConfig.command + " install:install-file -Dfile="+ targetPath+"/dist.war   -DgroupId="+ publishConfig.groupId +" -DartifactId="+ publishConfig.artifactId +"  -Dversion="+ publishConfig.version +" -Dpackaging=war";
	var process = require('child_process');
	var installWarProcess =	process.exec(installCommandStr, function(err,stdout,stderr){
		if(err) {
			console.log('install war error:'+stderr);
		}
	});
	installWarProcess.stdout.on('data',function(data){
		console.info(data);
	});
	installWarProcess.on('exit',function(data){
		console.info('intall  war success');

		var publishCommandStr =  publishConfig.command + " deploy:deploy-file  -Dfile="+ targetPath+"/dist.war   -DgroupId="+ publishConfig.groupId +" -DartifactId="+ publishConfig.artifactId +"  -Dversion="+ publishConfig.version +" -Dpackaging=war  -DrepositoryId="+ publishConfig.repositoryId +" -Durl=" +publishConfig.repositoryURL;
		console.info(publishCommandStr);
		var publishWarProcess =	process.exec(publishCommandStr, function(err,stdout,stderr){
			if(err) {
				console.log('publish war error:'+stderr);
			}
		});

		publishWarProcess.stdout.on('data',function(data){
			console.info(data);
		});
		publishWarProcess.on('exit',function(data){
			console.info('publish  war success');
		});

	});
};

iweb.cli.server = function(port, moduleName){

	port = port || '8080';
	var WebpackDevServer = require("webpack-dev-server");
	var webpack = require("webpack");
	var tragetPath = fs.realpathSync('.');
	var iwebHome = tragetPath + "/iweb_home";
	var webpackConfig;
	var serverConfig = require(tragetPath + '/config/webpack-dev-server.config');
	var iwebConfig = require(tragetPath + '/config/iweb.config');

	//单项目
	if (!fs.existsSync(iwebHome)){
		webpackConfig = getWebpackConfig('development');
	}else{
		if (!moduleName){
			throw new Error('multi-project mast config moduleName (-m)');
		}
		syncModule();
		webpackConfig = getWebpackConfig('development', moduleName);
	}

	//iweb.cli.build('development');
	var compiler = webpack(webpackConfig);


	//处理proxy中的ctx
	if (serverConfig['proxy']){
		var proxy = serverConfig['proxy'];
		var webContext = iwebConfig['webContext'];
		for (var key in proxy){
			if (key.indexOf('_webContext_') != -1){
				var newKey = key.replace('_webContext_', webContext);
				proxy[newKey] = proxy[key]
				delete proxy[key];
			}
		}
	}

	//for (var key in proxy){
	//	console.log(key)
	//	console.log(proxy[key])
	//}

	var server = new WebpackDevServer(compiler, serverConfig);

	var server = new WebpackDevServer(compiler, serverConfig);
	var mockServerConf = iwebConfig['mockServer'];
	if (mockServerConf){
		var bodyParser = require('body-parser');
		server.app.use( bodyParser.json() );       // to support JSON-encoded bodies
		server.app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
			extended: true
		}));
	}
	if (mockServerConf){
		if ( mockServerConf['dispatchUrl']){
			var dispatchUrl =mockServerConf['dispatchUrl'];
			server.app.post(dispatchUrl, function(req, res){
				var ctrl = req.body.ctrl;
				var method = req.body.method;
				ctrl = ctrl.replace(/\./g, '/');
				var mockFile = require(tragetPath + '/mockData/' + ctrl + '/' + method + '.json');
				//res.write("ok test!");
				//res.json(req.params);
				//res.end(req.query.ctrl);
				res.end(JSON.stringify(mockFile));
			});
		}
		if (mockServerConf['requestMapping']){
			mockServerConf['requestMapping'].forEach(function(reqConf){
				server.app[reqConf['type']](reqConf['url'], function(req,res){
					var mockFile = require(tragetPath + '/mockData/' + reqConf['json'])
					res.end(JSON.stringify(mockFile));
				})

			});
		}

	}

	server.listen(port, "localhost", function() {

	});
	//console.log("server start success!")
}

iweb.cli.run = function(){

	var argv = require('yargs')
	//.usage('npm <command>')
			.command('init', 'init iweb project', function(){
				iweb.cli.init();
			})
			.command('build', 'build iweb project', function () {
				iweb.cli.build();
			})
			.command('publish', 'publish iweb project', function () {
				iweb.cli.publish();
			})
			.command('server', 'startup a web server', function(yargs){
				argv = yargs.option('p', {
							alias: 'port',
							description: 'server port'
						})
						.example('iweb server -p 8080', 'start server on port 8080')
						.option('m', {
							alias: 'module',
							description: 'module name, only multi-project use'
						})
						.example('iweb server -m hr', 'start server with module hr')
						.help('h')
						.alias('h', 'help')
						.argv;
				iweb.cli.server(argv.p, argv.m);
			})
			.help('h')
			.alias('h', 'help')
			.version('1.1.0')
			.alias('v', 'version')
			.argv;
};

iweb.cli.run(process.argv);
