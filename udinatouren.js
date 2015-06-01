#!/usr/bin/node
var XMLWriter = require('xml-writer');
var http = require('http');
var fs = require('fs');
var geodesy = require('geodesy');
var htmlparser = require('htmlparser2');
var Entities = require('html-entities').AllHtmlEntities;

var out = "";
var parser = new htmlparser.Parser({
    decodeEntitites: true,
    ontext: function(text){
        out += text;
    }
});
var entities = new Entities();







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
    //console.log(opts.path);
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

//getData('GetLanguageList', 'LanguageList');

// LanguageID 1 / <bool> include subcategories
getData('GetCategoryList/1/true', 'CategoryList');

/*

   LanguageID / Categories / RouteMinLength / Routemaxlength ? bbox= <bounding box>
   Bounding box:
http://www.latlong.net/lat-long-utm.html
Coordinates are in UTM Zone 32V EUREF89
*/

//Using SubCategoryID
var facilities = {
    38: { //small campground
    /*
     { AttributeID: 6, Name: 'Drikkevand' },
     { AttributeID: 9, Name: 'Shelter' },
     { AttributeID: 10, Name: 'Bålplads' },
     */
        'symbol': 'Campground'
    },

    39: { //Large campground
        /*
         { AttributeID: 6, Name: 'Drikkevand' },
         { AttributeID: 7, Name: 'Brænde' },
         { AttributeID: 9, Name: 'Shelter' },
         { AttributeID: 10, Name: 'Bålplads' },
         { AttributeID: 12, Name: 'Mulighed for bad' },
         */
        'symbol': 'Campground'
    },
    15: { //bonfire place
        'symbol': 'Bonfire'
    },
    16: { //bonfire building
        'symbol': 'Bonfire'
    },
    129: { //water post
        'symbol': 'Drinking Water'
    },
    13: { //Madpakkehus
        'symbol': 'Restaurant'
    },
    18: { //Toilet
        'symbol': 'Restrooms'
    },
    17: { //Parking lot
        'symbol': 'Parking Area'
    },
    34: { //Naturfitness
        'symbol': 'Fitness Center'
    },
    37: { //Fugletaarn
        'symbol': 'Oil Field'
    },
    129: { //Drikkevandspost
        'symbol': 'Drinking Water'
    },
    24: { //Big tree
        'symbol': 'Park'
    },
    114: { //See paa stjerner
        'symbol': 'Scenic Area'
    },
    48: { //Frit fiskeri
        'symbol': 'Fishing Area'
    },
    121: { //Isaetningssted
        'symbol': 'Boat Ramp'
    },
    125: { //Landgangssted
        'symbol': 'Boat Ramp'
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
                //console.log(i);
                //GetFacilityData/<lang>/<facilityID/<coordtype 1=lon/lat,2=UTM zone 32N>
                getData('GetFacilityData/1/'+i['FacilityID']+"/1", "", function(fac){
                    //console.log(fac);

                    if(fac.GeometryType === "POINT"){
                        //We need to convert FacilityGeometryWKT from UTM to WGS84.
                        //...no, not for GetFacility_Data_
                        var parts = /POINT\((\S+) (\S+)\)/.exec(fac.FacilityGeometryWKT);

                        //We need to convert html entities...
                        out = "";
                        if(fac.LongDescription !== ""){
                        var dec = entities.decode(fac.LongDescription);
                        //...then remove tags with the parser.
                        parser.write(dec);
                        parser.end();
                        }else{
                            out = fac.ShortDescription;
                        }

                        var wpt = {
                            lat: parts[2],
                            lon: parts[1],
                            name: fac.Name,
                            desc: out
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
    fs.writeFile("udinaturen.gpx", xw.toString());

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
