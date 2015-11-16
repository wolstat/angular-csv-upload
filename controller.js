///add/purchase/csv/year/:year @ /sys/templates/add-purchase-csv.htm
theseControllers.controller('sysAddCsvPurchase', ['$scope', '$http', '$routeParams', '$window', 'adminLib',
  function ($scope, $http, $routeParams, $window, adminLib) {
    var c = $scope;
    c.RP = $routeParams;//c.RP.entity
    adminLib.userSetUp(c); //c.umeta, is_lab_admin, multimarket, userMarketList, facilityList are set here

    c.import_complete = false; //prevent double imports
    c.bulkholding = "true";
    c.last_import_id = "";//for clickthrough link
    c.resetForm = function (){
        $scope.freeze_file_select = false;
        $scope.file_import_disabled = true;
        //c.file_import_disabled = true;
        $scope.file_valid_err = false;
        $scope.file_validation_success = false;
        $scope.file_format_err = false;
        $scope.file_format_msg = '';
        $scope.file_header_def_err = false;
        $scope.file_header_err = false;
        $scope.file_head_in_err = false;
        $scope.file_importing = false;
        //c.xxxxx_err = false;
        $scope.jsonImported = 0;
        $scope.csvCount = 0;
        $('#csvfile').val('');
        $scope.json = {};
        $scope.csv = "";
        $scope.final_success = false;
        $scope.import_fail = false;
    }
    c.resetForm();
    c.uploadme = {}; c.uploadme.src = "nothing special";
    c.$watch('uploadme.src', function( nv, ov ) {
        if( nv !== ov ) {c.newCsv();}
    });
    c.resetNewFile = function(){
        c.file_format_err = false;
        c.file_header_err = false;
        c.file_head_in_err = false;
    }
    c.newCsv = function () { 
        var data = c.uploadme.src;
        if ( data.substr(0, 9) === "NOT_A_CSV" ) { c.resetForm(); c.file_format_err = true; c.file_format_msg = data.substr(11); return;}
        var feedback = "", delim = "", feedbackdef = "",
        lines=data.split("\n"), d, f, passed = true, defpassed = true, deferrarr = [],
        headers = adminLib.trimArr( lines[0].split(",") ), defs = c.definitions;
        //console.log("newCsv called: data "+JSON.stringify(data));
        for (d in defs) {
            if ( defs[d].f_type === 'required' && headers.indexOf( d ) === -1 ) { //make sure req fields are present
              feedback += delim + d;
              passed = false; delim = ", ";
            }
            if ( defs[d].f_type === 'default' && headers.indexOf( d ) > -1 ) { //check id default fields are not present
              //feedbackdef += delim + d;
              deferrarr.push( d );
              defpassed = false;
            }
            //;
        }
        if (!defpassed) {
            c.file_header_def_msg = deferrarr.join(); c.file_header_def_err = true; }
        if (!passed) { c.file_header_err_list = feedback; c.file_header_err = true; $('#csvfile').val(''); return; }
        delim = "";
        for (f in headers) { if ( f in defs ) { //make sure all header names are valid
              feedback += delim + headers[f];
              passed = false; delim = ", ";
        }}
        if (!passed) { c.file_head_in_msg = feedback; c.file_head_in_err = true; $('#csvfile').val(''); return; }
        c.resetNewFile();
        c.importCsv(data);
    }
    c.importCsv = function (filein) {//to JSON
        //console.log("importCsv raw data:"+data);
        var data = filein.replace('\r\n', '\n');
        var lines=data.split("\n"), l, result = [], feedback = "", passed = true, 
        headers=lines[0].split(","), defs = c.definitions;
        c.csvCount = (lines.length);
        c.csvCountDisplay = (lines.length -  1);
        //console.log("%% importCsv csvCountDisplay:"+c.csvCountDisplay);
        lineloop: for(l=1;l<c.csvCount;l++){
            var d, f, obj = {}, currentline=lines[l].split(",");
            fieldloop: for( f in headers){ //field in line
              var fld = headers[f].trim(); //adminLib.getArr(defs, 'name', headers[f], l);
              //TODO: add validation message for incorrect # of entries on a line
              //if ( fld in defs ) {
                  var def = defs[fld];
              //console.log("%% importCsv l:"+l+" f:"+f+" currentline[f]:"+currentline[f]);
                  var value = currentline[f].trim(); //f is the field pos in the headerline
                  var regstr = def['regex'];
              //console.log("%% importCsv l:"+l+" f:"+f+" fld:"+fld+" def:"+JSON.stringify(def));
                  var regex = new RegExp( regstr, "i" );
                if ( regstr === "" || regex.test( value ) ) {
                  console.log("key:value pair "+fld+":'"+value+"'. Value is "+def.desc);
                  var setval = (def.v_type === 'number') ? (value - 0) : (value + "");
                  obj[headers[f]] = setval;
                } else {
                  feedback = "Data validation failed on line "+l+" for the key:value pair "+fld+":'"+value+"'. Value must be "+def.desc+".";
                  passed = false; break lineloop;
                }
              //} else { feedback = "Data definition not found on line "+l+"for field "+fld; break lineloop; }
            }
            defaultloop: for (d in defs) { //apply all default values
                //console.log("importCsv defaultloop f:"+f+"  d:"+d);
                if ( defs[d].f_type === 'default' ) obj[ d ] = defs[d].default_val;
            }
            result.push(obj);
        }
        if (!passed) { c.file_valid_msg = feedback; c.file_valid_err = true; $('#csvfile').val(''); return; }
        c.file_valid_err = false;
        c.file_validation_success = true;
        c.freeze_file_select = true;
        c.file_import_disabled = false;
        //console.log("importCsv bottom result :"+JSON.stringify(result));
        c.json = result;
    }
    c.sendJson = function () {
        if ( c.import_complete ) return;
        c.file_importing = true;
        c.jinx = 0;
        c.importOne(c.json[c.jinx]);
    }
    c.importOne = function(data){
      console.log("sendJson c.jsonImported:"+c.jsonImported+" c.jinx :"+c.jinx+" data:"+JSON.stringify(c.json[c.jinx]));
      //console.log("sendJson c.jsonImported:"+ c.jsonImported+" c.jinx :");
      $http.put('/rest/sys/insert/purchase/bulk', c.json[c.jinx])
          .success(function (data, status, headers, config) {
              //console.log("sendJson final response data[0]:"+JSON.stringify(data[0]))
              c.jsonImported++; c.jinx++;
              if ( c.jsonImported >= c.csvCountDisplay  ) { //final final
                  c.last_import_id = data[0]._id;
                  c.import_complete = true;
                  c.file_validation_success = false;
                  c.file_importing = false;
                  c.file_import_disabled = true;
                  c.final_success = true;
                  c.jinx = 0;
              } else {
                  c.importOne(c.json[c.jinx]);
              }
          }).error(function (data, status, headers, config) {
              c.import_fail = true;
              c.failedEntry = c.json[c.jinx];
              c.jinx = 0;
              console.log("FAIL importloop");
          });
    }
    c.definitions = {
      "year_29":{
            f_type:"default",
            v_type:"string",
            desc:"a string of 4 numbers",
            default_val:c.RP.year,
            regex:""
        },
      "modifiedBy":{
            f_type:"default",
            v_type:"string",
            desc:"a string",
            default_val:c.umeta.id,
            regex:""
        },
      "modifiedName":{
            f_type:"default",
            v_type:"string",
            desc:"a string",
            default_val:c.umeta.name,
            regex:""
        },
      "modifiedEmail":{
            f_type:"default",
            v_type:"string",
            desc:"a string",
            default_val:c.umeta.email,
            regex:""
        },
      "csv_import":{
            f_type:"default",
            default_exp:"the string 'true' (not a boolean)",
            desc:"the string 'true'",
            default_val:"true",
            regex:""
        },
      "is_trade_agreement":{
            f_type:"default",
            default_exp:"the string 'false' (not a boolean)",
            desc:"the string 'true'",
            default_val:"false",
            regex:""
        },
      "import_date":{
            f_type:"default",
            default_exp:"purchase date--- (mm/dd/yyyy)",
            desc:"the date of purchase in the format (mm/dd/yyyy)",
            default_val:adminLib.dateString(),
            regex:"^[0-9]{2}\/[0-9]{2}\/[0-9]{4}?$"
        },
      "budget_id_25":{
            f_type:"default",
            v_type:"string",
            default_exp:"'false'(string)",
            desc:"an empty string",
            default_val:"false",
            regex:""
        },
      "live":{
            f_type:"default",
            v_type:"string",
            default_exp:"'true'(string)",
            desc:"the string 'true' (not a boolean)",
            default_val:"true",
            regex:""
        },
      "project_code_5":{
            f_type:"default",
            v_type:"string",
            default_exp:"(empty string)",
            desc:"an empty string",
            default_val:"",
            regex:""
        },
      "project_id_seq":{
            f_type:"default",
            v_type:"string",
            default_exp:"(empty string)",
            desc:"an empty string",
            default_val:"",
            regex:""
        },
      "facility_3":{
            f_type:"default",
            v_type:"string",
            default_exp:"(empty string)",
            desc:"an empty string",
            default_val:"",
            regex:""
        },
      "Entity":{
            f_type:"default",
            v_type:"string",
            default_exp:"(empty string)",
            desc:"an empty string",
            default_val:"",
            regex:""
        },
      "planned_30":{
            f_type:"default",
            v_type:"string",
            default_exp:"(empty string)",
            desc:"an empty string",
            default_val:"",
            regex:""
        },
      "add_to_holding_tank_32_1":{
            f_type:"default",
            default_exp:"the string 'true' (not a boolean)",
            desc:"a valid URL",
            default_val:"true",
            regex:""
        },
      "amex_cardholder_13":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "p_cardholder_name_28":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "ram":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "screen_size":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "processor":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "manufacturer":{
            f_type:"optional",
            v_type:"string",
            desc:"a string",
            default_val:"",
            regex:""
        },
      "os":{
            f_type:"optional",
            v_type:"string",
            desc:"a string",
            default_val:"",
            regex:""
        },
      "hd":{
            f_type:"optional",
            v_type:"string",
            desc:"a string memory quantity",
            default_val:"",
            regex:""
        },
      "model_number":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "service_tag":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "holdingtank_location":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "order_number":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "finance_confirmed":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "manufacturer_27":{
            f_type:"optional",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "request_uid":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "request_name":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "request_email":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "depreciation_26":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "vendor_4":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "purchase_method_12":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "description_8":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "asset_class_2":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:""
        },
      "purchase_date_7":{
            f_type:"required",
            default_exp:"purchase date--- (mm/dd/yyyy)",
            desc:"the date of purchase in the format (mm/dd/yyyy)",
            default_val:"",
            regex:"^[0-9]{2}\/[0-9]{2}\/[0-9]{4}?$"
        },
      "attach_receipt_invoi_1":{
            f_type:"required",
            v_type:"string",
            desc:"a valid URL",
            default_val:"",
            regex:"^(https?:\/\/\\S+)?$"
        },
      "total_purchase_price_11":{
            f_type:"required",
            v_type:"number",
            desc:"numbers and optional decimal point (no dollar sign)",
            default_val:"",
            regex:"^[0-9\.]{2,12}$"
        }
    };
}])
.directive("fileread", [function () {
//http://stackoverflow.com/questions/17063000/ng-model-for-input-type-file
//similar implementation: // http://www.html5rocks.com/en/tutorials/file/dndfiles/ //
    return {
        scope: {
            fileread: "="
        },
        link: function (scope, element, attributes) {
            element.bind("change", function (changeEvent) {
                var reader = new FileReader();
                    reader.onload = function (loadEvent) {
                        scope.$apply(function () {
                          var filetype = changeEvent.target.files[0].type;
                            console.log("directive.fileread read file of type: "+filetype);
                            scope.fileread = 
                                ( filetype === 'text/csv' ) ?
                                loadEvent.target.result :
                                'NOT_A_CSV::'+filetype;
                        });
                    }
                reader.readAsText(changeEvent.target.files[0]);
            });
        }
    }
}]);
