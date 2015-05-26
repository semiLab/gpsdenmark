#!/usr/bin/node
var XMLWriter = require('xml-writer');
var http = require('http');
var fs = require('fs');
var geodesy = require('geodesy');

console.log("I am starting");

var uri =  '/wcf/Service.svc/json/';

var opts = {
    host: 'udinaturen.naturstyrelsen.dk',
    port: 80,
    //path: uri+'GetLanguageList',
    path: uri+'GetCategoryList/1/false',
    method: 'GET'
};
var returned = 0;
const total = 2;
function incReturned(){
    returned++;
    var p = Math.floor(returned / total * 100.0);
    //console.log(p+"%");
    if(p === 100){
        //    finish();
    }
}

var struct = {};
function getData(path, name, callback){
    opts.path = uri+path;
    var reqGet = http.request(opts, function(res){
        //console.log("statusCode: ", res.statusCode);
        var data = '';
        res.on('data', function(chunk){
            data += chunk;
        });
        res.on('end', function(){
            //console.log("Returned");
            //console.log(d.toString());
            try{
                var obj = JSON.parse(data);
            }catch(e){
                console.log("Error converting to JSON: "+e);
                console.log(data.toString());
            }
            if(typeof(callback) !== 'undefined'){
                callback(obj);
            }else{
                struct[name] = obj[name];
            }
            //incReturned();
        });
    });
    reqGet.end();
}
//opts.path = uri+'GetLanguageList';
//reqGet.end();


//getData('GetLanguageList', 'LanguageList');

// LanguageID 1 / <bool> include subcategories
getData('GetCategoryList/1/true', 'CategoryList');

/*

   LanguageID / Categories / RouteMinLength / Routemaxlength ? bbox= <bounding box>
   Bounding box:
http://www.latlong.net/lat-long-utm.html
Coordinates are in UTM Zone 32V EUREF89
*/

var facilities = {
    38: { //small campground
        'symbol': 'Campground'
    },

    39: { //Large campground
        'symbol': 'Campground'
    },
    15: { //bonfire place
        'symbol': 'Bonfire'
    },
    16: { //bonfire shelter
        'symbol': 'Bonfire'
    },
    129: { //water post
        'symbol': 'Drinking Water'
    }
};

var nsjl = "622794,6227572,736528,6158743";
Object.keys(facilities).forEach(function(facility){
    //var facility = 38;
    facilities[facility].gotCount = false;
    getData('FindFacilities/1/'+facility+'/0/0?bbox='+nsjl, '', function(data){
        console.log("Number found: "+data['Count']);
        var symbol = facilities[facility].symbol;
        facilities[facility] = {
            'gotCount' : true,
            'total': data['Count'],
            'received': 0,
            'symbol': symbol,
            data : {}
        };
        //    console.log(data);
        getData('GetSearchResultItems/'+data['SearchResultID']+"/0/"+data['Count']+"/0/1", "", function(searchRes){
            //console.log("logging data");
            //console.log(data);
            var items = searchRes['SearchResultItemList'];
            //console.log(items[0]);
            items.forEach(function(i){
                //GetFacilityData/<lang>/<facilityID/<coordtype 1=lon/lat,2=UTM zone 32N>
                getData('GetFacilityData/1/'+i['FacilityID'], "/1", function(fac){
                    //console.log(fac);

                    if(fac.GeometryType === "POINT"){
                        //We need to convert FacilityGeometryWKT from UTM to WGS84.

                        var parts = /POINT\((\S+) (\S+)\)/.exec(fac.FacilityGeometryWKT);

                        //console.log(parts[0]);
                        //var coordStr = "32 N "+parts[1]+" "+parts[2];
                        //console.log(coordStr);
                        //var utm = geodesy.Utm.parse(coordStr);
                        //var latlon = utm.toLatLonE();
                        var wpt = {
                            //lat: latlon.lat,
                            //lon: latlon.lon,
                            lat: parts[1],
                            lon: parts[2],
                            name: fac.Name,
                            desc: fac.LongDescription
                        };
                        if((facility == 38 || facility == 39) 
                           && (/helter/.test(fac.ShortDescription) || /helter/.test(fac.Name)) ){
                            wpt.symbol = 'Shelter';
                        }
                        facilities[facility].data[i['FacilityID']] = wpt;
                    }
                    facilities[facility].received++;
                    checkDone();
                });
            });

        });

    });

});

function checkDone(){
    var done = true;
    for(var f in facilities){
        var fac = facilities[f];
        //console.log(fac);
        console.log(fac.received+"/"+fac.total);
        if(!fac.gotCount || fac.received < fac.total){
            return;
        }
    }
    finish();
}

function finish(){
    console.log("Finished");
    struct['CategoryList'].forEach(function(cat){
        console.log(cat.CategoryID+": "+cat.Name);
        cat.SubCategoryList.forEach(function(sc){
            console.log("\t"+sc.SubCategoryID+": "+sc.Name);
            console.log(sc);
       });
       });
    //console.log(struct);
    //console.log(struct.CategoryList[0]);

    xw = new XMLWriter(true);
    xw.startDocument();
    xw.startElement('gpx');
    Object.keys(facilities).forEach(function(facility){
        for(var el in facilities[facility].data){
            createWpt(xw, facilities[facility].data[el], facilities[facility].symbol);
        }
    });
//    xw.startElement('wpt');
//    xw.writeAttribute('lat', 123);
    xw.endElement();
    xw.endDocument();
    fs.writeFile("mep.xml", xw.toString());

}
function createWpt(xw, obj, symbol){
    console.log(obj);
    console.log(symbol);
    xw.startElement('wpt');
    xw.writeAttribute('lat', obj.lat);
    xw.writeAttribute('lon', obj.lon);
    xw.writeElement('name', obj.name);
    xw.writeElement('cmt', obj.desc);
    xw.writeElement('sym', obj.symbol || symbol);
    xw.endElement();
}
