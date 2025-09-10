/**
 * Easy Spaces Space Form Scripts
 * Handles client-side logic for space forms
 */

var EasySpaces = EasySpaces || {};
EasySpaces.Space = EasySpaces.Space || {};

(function () {
    /**
     * Form OnLoad event handler
     */
    this.onLoad = function (executionContext) {
        var formContext = executionContext.getFormContext();
        
        // Initialize form
        initializeForm(formContext);
        
        // Register event handlers
        registerEventHandlers(formContext);
        
        // Apply conditional formatting
        applyConditionalFormatting(formContext);
        
        // Load space statistics
        if (formContext.ui.getFormType() !== 1) { // Not create form
            loadSpaceStatistics(formContext);
        }
    };
    
    /**
     * Calculate rates based on daily rate
     */
    this.calculateRates = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var dailyRate = formContext.getAttribute("es_dailyrate").getValue();
        
        if (dailyRate && dailyRate > 0) {
            // Calculate weekly rate (5 days with 10% discount)
            var weeklyRate = dailyRate * 5 * 0.9;
            formContext.getAttribute("es_weeklyrate").setValue(weeklyRate);
            
            // Calculate monthly rate (20 days with 20% discount)
            var monthlyRate = dailyRate * 20 * 0.8;
            formContext.getAttribute("es_monthlyrate").setValue(monthlyRate);
            
            // Calculate hourly rate (daily / 8 hours)
            var hourlyRate = dailyRate / 8;
            formContext.getAttribute("es_hourlyrate").setValue(hourlyRate);
            
            // Show calculation info
            formContext.ui.setFormNotification(
                "Rates calculated: Weekly (10% discount), Monthly (20% discount)",
                "INFO",
                "RATE_CALCULATION"
            );
            
            setTimeout(function() {
                formContext.ui.clearFormNotification("RATE_CALCULATION");
            }, 5000);
        }
    };
    
    /**
     * Market field OnChange event handler
     */
    this.onMarketChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var marketRef = formContext.getAttribute("es_marketid").getValue();
        
        if (marketRef && marketRef.length > 0) {
            // Retrieve market details
            Xrm.WebApi.retrieveRecord("es_market", marketRef[0].id, "?$select=es_name,es_city,es_state,es_timezone,es_defaulthourlyrate").then(
                function (market) {
                    // Set default pricing if not already set
                    var dailyRate = formContext.getAttribute("es_dailyrate").getValue();
                    if (!dailyRate && market.es_defaulthourlyrate) {
                        formContext.getAttribute("es_hourlyrate").setValue(market.es_defaulthourlyrate);
                        formContext.getAttribute("es_dailyrate").setValue(market.es_defaulthourlyrate * 8);
                        EasySpaces.Space.calculateRates(executionContext);
                    }
                    
                    // Update location display
                    updateLocationDisplay(formContext, market);
                },
                function (error) {
                    console.error("Error retrieving market details: " + error.message);
                }
            );
        }
    };
    
    /**
     * Space type OnChange event handler
     */
    this.onSpaceTypeChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var spaceType = formContext.getAttribute("es_spacetype").getValue();
        
        // Set default capacities based on space type
        switch (spaceType) {
            case 1: // Meeting Room
                formContext.getAttribute("es_mincapacity").setValue(2);
                formContext.getAttribute("es_maxcapacity").setValue(12);
                setDefaultAmenities(formContext, ["wifi", "whiteboard", "videoconferencing"]);
                break;
            case 2: // Conference Room
                formContext.getAttribute("es_mincapacity").setValue(10);
                formContext.getAttribute("es_maxcapacity").setValue(50);
                setDefaultAmenities(formContext, ["wifi", "projector", "videoconferencing", "soundsystem"]);
                break;
            case 3: // Training Room
                formContext.getAttribute("es_mincapacity").setValue(5);
                formContext.getAttribute("es_maxcapacity").setValue(30);
                setDefaultAmenities(formContext, ["wifi", "whiteboard", "projector"]);
                break;
            case 4: // Event Space
                formContext.getAttribute("es_mincapacity").setValue(20);
                formContext.getAttribute("es_maxcapacity").setValue(200);
                setDefaultAmenities(formContext, ["wifi", "soundsystem", "catering"]);
                break;
            case 5: // Hot Desk
                formContext.getAttribute("es_mincapacity").setValue(1);
                formContext.getAttribute("es_maxcapacity").setValue(1);
                setDefaultAmenities(formContext, ["wifi"]);
                break;
            case 6: // Private Office
                formContext.getAttribute("es_mincapacity").setValue(1);
                formContext.getAttribute("es_maxcapacity").setValue(4);
                setDefaultAmenities(formContext, ["wifi", "whiteboard"]);
                break;
        }
    };
    
    /**
     * Capacity OnChange event handler
     */
    this.onCapacityChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var minCapacity = formContext.getAttribute("es_mincapacity").getValue();
        var maxCapacity = formContext.getAttribute("es_maxcapacity").getValue();
        
        if (minCapacity && maxCapacity) {
            if (minCapacity > maxCapacity) {
                formContext.ui.setFormNotification(
                    "Minimum capacity cannot be greater than maximum capacity",
                    "ERROR",
                    "CAPACITY_ERROR"
                );
                formContext.getAttribute("es_mincapacity").setValue(maxCapacity);
            } else {
                formContext.ui.clearFormNotification("CAPACITY_ERROR");
            }
        }
        
        // Update square footage estimate if not set
        var squareFootage = formContext.getAttribute("es_squarefootage").getValue();
        if (!squareFootage && maxCapacity) {
            // Estimate 50 sq ft per person
            var estimatedSqFt = maxCapacity * 50;
            formContext.getAttribute("es_squarefootage").setValue(estimatedSqFt);
            formContext.ui.setFormNotification(
                "Square footage estimated based on capacity",
                "INFO",
                "SQFT_ESTIMATE"
            );
        }
    };
    
    /**
     * Approval required OnChange event handler
     */
    this.onApprovalRequiredChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var requiresApproval = formContext.getAttribute("es_requiresapproval").getValue();
        
        var approverControl = formContext.getControl("es_approver");
        
        if (requiresApproval) {
            approverControl.setVisible(true);
            formContext.getAttribute("es_approver").setRequiredLevel("required");
            formContext.ui.setFormNotification(
                "Please select an approver for this space",
                "WARNING",
                "APPROVER_REQUIRED"
            );
        } else {
            approverControl.setVisible(false);
            formContext.getAttribute("es_approver").setRequiredLevel("none");
            formContext.getAttribute("es_approver").setValue(null);
            formContext.ui.clearFormNotification("APPROVER_REQUIRED");
        }
    };
    
    /**
     * Status OnChange event handler
     */
    this.onStatusChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var status = formContext.getAttribute("es_status").getValue();
        
        // Apply status-based formatting
        applyStatusFormatting(formContext, status);
        
        // Show/hide maintenance section
        if (status === 3 || status === 4) { // Under Maintenance or Renovation
            formContext.ui.tabs.get("CONFIG_TAB").sections.get("MAINTENANCE_SECTION").setVisible(true);
            formContext.getAttribute("es_maintenancenotes").setRequiredLevel("required");
            formContext.getAttribute("es_lastmaintenancedate").setValue(new Date());
        } else {
            formContext.ui.tabs.get("CONFIG_TAB").sections.get("MAINTENANCE_SECTION").setVisible(false);
            formContext.getAttribute("es_maintenancenotes").setRequiredLevel("none");
        }
        
        // Update availability for reservations
        if (status !== 1) { // Not Available
            showReservationWarning(formContext);
        }
    };
    
    // Private helper functions
    
    function initializeForm(formContext) {
        var formType = formContext.ui.getFormType();
        
        // Set defaults for new records
        if (formType === 1) { // Create
            formContext.getAttribute("es_status").setValue(1); // Available
            formContext.getAttribute("es_wifi").setValue(true);
            formContext.getAttribute("es_depositrequired").setValue(true);
            formContext.getAttribute("es_mincapacity").setValue(1);
            formContext.getAttribute("es_minbookingduration").setValue(1);
            formContext.getAttribute("es_maxbookingduration").setValue(30);
            formContext.getAttribute("es_advancebookingrequired").setValue(1);
            formContext.getAttribute("es_cancellationperiod").setValue(24);
        }
        
        // Disable calculated fields
        disableCalculatedFields(formContext);
        
        // Hide maintenance section initially
        var maintenanceSection = formContext.ui.tabs.get("CONFIG_TAB").sections.get("MAINTENANCE_SECTION");
        if (maintenanceSection) {
            maintenanceSection.setVisible(false);
        }
    }
    
    function registerEventHandlers(formContext) {
        formContext.getAttribute("es_dailyrate").addOnChange(EasySpaces.Space.calculateRates);
        formContext.getAttribute("es_marketid").addOnChange(EasySpaces.Space.onMarketChange);
        formContext.getAttribute("es_spacetype").addOnChange(EasySpaces.Space.onSpaceTypeChange);
        formContext.getAttribute("es_mincapacity").addOnChange(EasySpaces.Space.onCapacityChange);
        formContext.getAttribute("es_maxcapacity").addOnChange(EasySpaces.Space.onCapacityChange);
        formContext.getAttribute("es_requiresapproval").addOnChange(EasySpaces.Space.onApprovalRequiredChange);
        formContext.getAttribute("es_status").addOnChange(EasySpaces.Space.onStatusChange);
        formContext.getAttribute("es_depositrequired").addOnChange(onDepositRequiredChange);
    }
    
    function applyConditionalFormatting(formContext) {
        var status = formContext.getAttribute("es_status").getValue();
        applyStatusFormatting(formContext, status);
        
        // Check approval field
        var requiresApproval = formContext.getAttribute("es_requiresapproval").getValue();
        if (!requiresApproval) {
            formContext.getControl("es_approver").setVisible(false);
        }
    }
    
    function applyStatusFormatting(formContext, status) {
        var headerControl = formContext.ui.controls.get("header_es_status");
        
        if (headerControl) {
            switch (status) {
                case 1: // Available
                    // Green indicator
                    break;
                case 2: // Occupied
                    // Yellow indicator
                    break;
                case 3: // Under Maintenance
                case 4: // Renovation
                    // Red indicator
                    formContext.ui.setFormNotification(
                        "This space is currently unavailable for reservations",
                        "WARNING",
                        "UNAVAILABLE_STATUS"
                    );
                    break;
                case 5: // Inactive
                    // Gray indicator
                    formContext.ui.setFormNotification(
                        "This space is inactive and cannot accept reservations",
                        "ERROR",
                        "INACTIVE_STATUS"
                    );
                    break;
            }
        }
    }
    
    function loadSpaceStatistics(formContext) {
        var spaceId = formContext.data.entity.getId().replace("{", "").replace("}", "");
        
        // Query for reservation statistics
        var fetchXml = [
            "<fetch aggregate='true'>",
            "  <entity name='es_reservation'>",
            "    <attribute name='es_totalamount' alias='revenue' aggregate='sum' />",
            "    <attribute name='es_reservationid' alias='count' aggregate='count' />",
            "    <filter>",
            "      <condition attribute='es_spaceid' operator='eq' value='" + spaceId + "' />",
            "      <condition attribute='es_status' operator='in'>",
            "        <value>3</value>",
            "        <value>4</value>",
            "        <value>5</value>",
            "      </condition>",
            "    </filter>",
            "  </entity>",
            "</fetch>"
        ].join("");
        
        Xrm.WebApi.retrieveMultipleRecords("es_reservation", "?fetchXml=" + encodeURIComponent(fetchXml)).then(
            function (result) {
                if (result.entities.length > 0) {
                    var stats = result.entities[0];
                    
                    // Display statistics
                    var statsMessage = "Lifetime Stats: " + 
                        (stats.count || 0) + " reservations, " +
                        "$" + (stats.revenue || 0).toFixed(2) + " revenue";
                    
                    formContext.ui.setFormNotification(statsMessage, "INFO", "SPACE_STATS");
                }
            },
            function (error) {
                console.error("Error loading statistics: " + error.message);
            }
        );
    }
    
    function updateLocationDisplay(formContext, market) {
        var locationInfo = market.es_name + " - " + market.es_city + ", " + market.es_state;
        formContext.ui.setFormNotification(
            "Location: " + locationInfo,
            "INFO",
            "LOCATION_INFO"
        );
    }
    
    function setDefaultAmenities(formContext, amenities) {
        var amenityMap = {
            "wifi": "es_wifi",
            "whiteboard": "es_whiteboard",
            "projector": "es_projector",
            "videoconferencing": "es_videoconferencing",
            "soundsystem": "es_soundsystem",
            "catering": "es_catering"
        };
        
        // Reset all amenities
        Object.values(amenityMap).forEach(function(field) {
            formContext.getAttribute(field).setValue(false);
        });
        
        // Set selected amenities
        amenities.forEach(function(amenity) {
            if (amenityMap[amenity]) {
                formContext.getAttribute(amenityMap[amenity]).setValue(true);
            }
        });
    }
    
    function disableCalculatedFields(formContext) {
        var calculatedFields = [
            "es_totalrevenue",
            "es_occupancyrate",
            "es_totalreservations",
            "es_averagerevenueperday",
            "es_currentoccupancy",
            "es_lastreservationdate",
            "es_nextavailabledate"
        ];
        
        calculatedFields.forEach(function(fieldName) {
            var control = formContext.getControl(fieldName);
            if (control) {
                control.setDisabled(true);
            }
        });
    }
    
    function onDepositRequiredChange(executionContext) {
        var formContext = executionContext.getFormContext();
        var depositRequired = formContext.getAttribute("es_depositrequired").getValue();
        var depositAmountControl = formContext.getControl("es_depositamount");
        
        if (depositRequired) {
            depositAmountControl.setVisible(true);
            formContext.getAttribute("es_depositamount").setRequiredLevel("required");
            
            // Set default deposit amount if not set
            var depositAmount = formContext.getAttribute("es_depositamount").getValue();
            var dailyRate = formContext.getAttribute("es_dailyrate").getValue();
            
            if (!depositAmount && dailyRate) {
                // Default to 50% of daily rate
                formContext.getAttribute("es_depositamount").setValue(dailyRate * 0.5);
            }
        } else {
            depositAmountControl.setVisible(false);
            formContext.getAttribute("es_depositamount").setRequiredLevel("none");
            formContext.getAttribute("es_depositamount").setValue(null);
        }
    }
    
    function showReservationWarning(formContext) {
        // Check for active reservations
        var spaceId = formContext.data.entity.getId().replace("{", "").replace("}", "");
        var today = new Date().toISOString();
        
        var fetchXml = [
            "<fetch>",
            "  <entity name='es_reservation'>",
            "    <attribute name='es_reservationid' />",
            "    <filter>",
            "      <condition attribute='es_spaceid' operator='eq' value='" + spaceId + "' />",
            "      <condition attribute='es_enddate' operator='ge' value='" + today + "' />",
            "      <condition attribute='es_status' operator='in'>",
            "        <value>2</value>",
            "        <value>3</value>",
            "        <value>4</value>",
            "      </condition>",
            "    </filter>",
            "  </entity>",
            "</fetch>"
        ].join("");
        
        Xrm.WebApi.retrieveMultipleRecords("es_reservation", "?fetchXml=" + encodeURIComponent(fetchXml) + "&$count=true").then(
            function (result) {
                if (result.entities.length > 0) {
                    formContext.ui.setFormNotification(
                        "Warning: This space has " + result.entities.length + " active/future reservations that may be affected",
                        "WARNING",
                        "ACTIVE_RESERVATIONS"
                    );
                    
                    // Create task to review reservations
                    var confirmResult = confirm("There are " + result.entities.length + " active reservations. Do you want to create a task to review them?");
                    
                    if (confirmResult) {
                        var task = {
                            "subject": "Review affected reservations for space status change",
                            "description": "Space status changed. Please review and notify affected customers.",
                            "regardingobjectid_es_space@odata.bind": "/es_spaces(" + spaceId + ")",
                            "scheduledend": new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
                        };
                        
                        Xrm.WebApi.createRecord("task", task).then(
                            function (result) {
                                formContext.ui.setFormNotification(
                                    "Task created to review affected reservations",
                                    "INFO",
                                    "TASK_CREATED"
                                );
                            },
                            function (error) {
                                console.error("Error creating task: " + error.message);
                            }
                        );
                    }
                }
            },
            function (error) {
                console.error("Error checking reservations: " + error.message);
            }
        );
    }
    
}).call(EasySpaces.Space);