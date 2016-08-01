/*jshint -W003, -W097, -W117, -W026 */
'use strict';
var Promise = require('bluebird');
var _ = require('underscore');
var http = require('http');
var https = require('https');
var Promise=require('bluebird');
var rp = require('../request-config');
var config = require('../conf/config');
var moment=require('moment');
var comparison=require('../eid-obs-compare');
var obsService=require('./openmrs-rest/obs.service');
var etlLogger = require('../etl-file-logger');
var db=require('../etl-db');
var eidResultsSchema=require('../eid-lab-results');
module.exports = function() {
  function getResource(host,apiKey){
    var link=host+':'+config.eid.port+config.eid.generalPath;
    var queryString={
      apikey:apiKey
    }
    var resource={
      uri:link,
      query:queryString
    }
    return resource;
  }
  function getCd4Resource(host,apiKey){
    var link=host+':'+config.eid.port+config.eid.cd4PanelPath;
    var queryString={
      apikey:apiKey
    }
    var resource={
      uri:link,
      query:queryString
    }
    return resource;
  }
  function getEIDTestResultsByPatientIdentifier(patientIdentifier,startDate,endDate){
   var results={
     viralLoad:[],
     pcr:[],
     cd4Panel:[],
     ampathViralLoadServerIsDown:false,
     ampathPcrServerIsDown:false,
     ampathCd4ServerIsDown:false,
     alupeViralLoadServerIsDown:false,
     alupePcrServerIsDown:false,
     alupeCd4ServerIsDown:false
   }
   /*var promise1=getAmpathViralLoadTestResultsByPatientIdentifier(patientIdentifier);
   var promise2=getAmpathPcrTestResultsByPatientIdentifier(patientIdentifier);
   var promise3=getAmpathCd4TestResultsByPatientIdentifier(patientIdentifier,startDate,endDate);
   var promise4=getAlupeViralLoadTestResultsByPatientIdentifier(patientIdentifier);
   var promise5=getAlupePcrTestResultsByPatientIdentifier(patientIdentifier);
   var promiseArray=[promise1,promise2,promise3,promise4,promise5];*/
   return new Promise(function(resolve,reject){
   getAmpathViralLoadTestResultsByPatientIdentifier(patientIdentifier)
   .then(function(response){
     if(response instanceof Array){
      results.viralLoad=response;
     }
     else{
       results.ampathViralLoadServerIsDown=true;
       results.ampathViralLoadErrorMsg=response;
     }
     return getAmpathPcrTestResultsByPatientIdentifier(patientIdentifier);
   })
   .then(function(response){
     if(response instanceof Array){
       results.pcr=response;
     }
     else{
       results.ampathPcrServerIsDown=true;
       results.ampathPcrErrorMsg=response;
     }
     return getAmpathCd4TestResultsByPatientIdentifier(patientIdentifier,startDate,endDate);
   })
   .then(function(response){
     if(response instanceof Array){
      results.cd4Panel=response;
     }
     else{
       results.ampathCd4ServerIsDown=true;
       results.ampathCd4ErrorMsg=response;
     }
     return getAlupeViralLoadTestResultsByPatientIdentifier(patientIdentifier);
   })
   .then(function(response){
     if(response instanceof Array){
     _.each(response,function(viralLoad){
       results.viralLoad.push(viralLoad);
     })
   }
   else{
     results.alupeViralLoadServerIsDown=true;
     results.AlupeViralLoadErrorMsg=response;
   }
     return getAlupePcrTestResultsByPatientIdentifier(patientIdentifier);
   })
   .then(function(response){
     if(response instanceof Array){
     _.each(response,function(pcr){
       results.pcr.push(pcr);
     })
   }
   else{
     results.alupePcrServerIsDown=true;
     results.AlupePcrErrorMsg=response;
   }
     resolve(results);
   })
   .catch(function(error){
     reject(error);
   })
 });
 }
function getAllEIDTestResultsByPatientUuId(patientUuId,startDate,endDate){
    return new Promise(function(resolve,reject){
      obsService.getPatientIdentifiers(patientUuId)
      .then(function(response){
        return getEIDTestResultsByPatientIdentifier(response.identifiers,startDate,endDate)
      })
      .then(function(eidResponse){
        resolve(eidResponse);
        console.log("eid response+++++++++++++++++++++++++++++++++++++++",eidResponse);
      })
      .catch(function(error){
        reject(error);
        console.log("getAllEIDTestResultsByPatientUuId called ++++++++++++++++++++++++++++++++++++++++++++++++",error);
        //etlLogger.logRequestError('Error getting eid results. Details:' + error, config.logging.eidFile, config.logging.eidPath);
      })
  });
}
function getAmpathViralLoadTestResultsByPatientIdentifier(patientIdentifier){
  var resource=getResource(config.eid.host.ampath,config.eid.ampath.generalApiKey);
  var queryString=resource.query;
  queryString.patientID=patientIdentifier;
  queryString.test=2;
  var ampathVLPromise=rp.getRequestPromise(queryString,resource.uri);
  return new Promise(function(resolve,reject){
    getResultsFromSingleServer(ampathVLPromise,resolve,reject);
  });
}
function getAlupeViralLoadTestResultsByPatientIdentifier(patientIdentifier){
  var resource=getResource(config.eid.host.alupe,config.eid.alupe.generalApiKey);
  var queryString=resource.query;
  queryString.patientID=patientIdentifier;
  queryString.test=2;
  var alupeVLPromise=rp.getRequestPromise(queryString,resource.uri);
  return new Promise(function(resolve,reject){
    getResultsFromSingleServer(alupeVLPromise,resolve,reject);
  });
}
function getAmpathPcrTestResultsByPatientIdentifier(patientIdentifier){
  var resource=getResource(config.eid.host.ampath,config.eid.ampath.generalApiKey);
  var queryString=resource.query;
  queryString.patientID=patientIdentifier;
  queryString.test=1;
  var ampathPcrPromise=rp.getRequestPromise(queryString,resource.uri);
  return new Promise(function(resolve,reject){
    getResultsFromSingleServer(ampathPcrPromise,resolve,reject);
  });
}
function getAlupePcrTestResultsByPatientIdentifier(patientIdentifier){
  var resource=getResource(config.eid.host.alupe,config.eid.alupe.generalApiKey);
  var queryString=resource.query;
  queryString.patientID=patientIdentifier;
  queryString.test=1;
  var alupePcrPromise=rp.getRequestPromise(queryString,resource.uri);
  return new Promise(function(resolve,reject){
    getResultsFromSingleServer(alupePcrPromise,resolve,reject);
  });
}
function getAmpathCd4TestResultsByPatientIdentifier(patientIdentifier,startDate,endDate){
  var resource=getCd4Resource(config.eid.host.ampath,config.eid.ampath.cd4ApiKey);
  var queryString=resource.query;
  queryString.patientID=patientIdentifier;
  queryString.startDate=startDate;
  queryString.endDate=endDate;
  var ampathCd4Promise=rp.getRequestPromise(queryString,resource.uri);
  return new Promise(function(resolve,reject){
    getResultsFromSingleServer(ampathCd4Promise,resolve,reject);
  });
}
function getAlupeCd4TestResultsByPatientIdentifier(patientIdentifier,startDate,endDate){
  var resource=getCd4Resource(config.eid.host.alupe,config.eid.alupe.cd4ApiKey);
  var queryString=resource.query;
  queryString.patientID=patientIdentifier;
  queryString.startDate=startDate;
  queryString.endDate=endDate;
  var alupeCd4Promise=rp.getRequestPromise(queryString,resource.uri);
  return new Promise(function(resolve,reject){
    getResultsFromSingleServer(alupeCd4Promise,resolve,reject);
  });
}
function getResultsfromMultipleServers(ampathVLPromise,alupeVLPromise,resolve,reject){
  var payLoadArray=[];
  ampathVLPromise.then(function(response){
    payLoadArray=response.posts;
    return alupeVLPromise;
  })
  .then(function(response){
    var concatenatedArray =payLoadArray.concat(response.posts);
    resolve(concatenatedArray);
  })
  .catch(function(error){
    reject(error);
     etlLogger.logRequestError('Viral load request error. Details:' + error, config.logging.eidFile, config.logging.eidPath);
  })
}
function getResultsFromSingleServer(promise,resolve,reject){
  var payLoadArray=[];
  promise.then(function(response){
    payLoadArray=response.posts;
    resolve(payLoadArray);
  })
  .catch(function(error){
    resolve(error);
     //etlLogger.logRequestError('Viral load request error. Details:' + error, config.logging.eidFile, config.logging.eidPath);
  })
}
 function getSynchronizedPatientLabResults(request,reply){
   var queryParts = {
     columns:[eidResultsSchema.patientLabResultsSchema.parameters[1].name,
   eidResultsSchema.patientLabResultsSchema.parameters[2].name,
   eidResultsSchema.patientLabResultsSchema.parameters[3].name],
     table: eidResultsSchema.patientLabResultsSchema.table.schema+'.'
     +eidResultsSchema.patientLabResultsSchema.table.tableName +' ',
     values:[request.query.patientUuId]
   };
   var promise1=getAllEIDTestResultsByPatientUuId(request.query.patientUuId,request.query.startDate,request.query.endDate);
   var promise2=obsService.getPatientAllTestObsByPatientUuId(request.query.patientUuId);
   var mergedEidResults={};
 return new Promise(function(resolve,reject){
   promise1.then(function(response){
     mergedEidResults=response;
     return promise2;
   })
   .then(function(obsResponse){
     var missingResult=comparison.findAllMissingEidResults(mergedEidResults,obsResponse);
     if(!_.isEmpty(missingResult)){
       obsService.postAllObsToAMRS(missingResult,request.query.patientUuId);
     }
     return obsService.getPatientTodaysTestObsByPatientUuId(request.query.patientUuId)
     .then(function(response){
       reply({updatedObs:response});
       saveEidSyncLog(queryParts,function(response){});
     });
   })
   .catch(function(error){
     reject(error);
     etlLogger.logRequestError('SynchronizedPatientLabResults request error. Details:' + error, config.logging.eidFile, config.logging.eidPath);
   })
 });
 }
 function saveEidSyncLog(queryParts,callback){
   db.insertQueryServer(queryParts,function(result){
     callback(result);
   });
 }
 function updateEidSyncLog(queryParts,callback){
   db.updateQueryServer(queryParts,function(result){
     callback(result);
   });
 }
 return {
   getSynchronizedPatientLabResults:getSynchronizedPatientLabResults,
   getAllEIDTestResultsByPatientUuId:getAllEIDTestResultsByPatientUuId,
   getEIDTestResultsByPatientIdentifier:getEIDTestResultsByPatientIdentifier,
   getResultsfromMultipleServers:getResultsfromMultipleServers,
   getResultsFromSingleServer:getResultsFromSingleServer,
   saveEidSyncLog:saveEidSyncLog,
   updateEidSyncLog:updateEidSyncLog,
   getAmpathViralLoadTestResultsByPatientIdentifier:getAmpathViralLoadTestResultsByPatientIdentifier,
   getAmpathCd4TestResultsByPatientIdentifier:getAmpathCd4TestResultsByPatientIdentifier,
   getAmpathPcrTestResultsByPatientIdentifier:getAmpathPcrTestResultsByPatientIdentifier,
   getResource:getResource,
   getCd4Resource:getCd4Resource,
   getAlupeViralLoadTestResultsByPatientIdentifier:getAlupeViralLoadTestResultsByPatientIdentifier,
   getAlupePcrTestResultsByPatientIdentifier:getAlupePcrTestResultsByPatientIdentifier,
   getAlupeCd4TestResultsByPatientIdentifier:getAlupeCd4TestResultsByPatientIdentifier
 }
 }();
