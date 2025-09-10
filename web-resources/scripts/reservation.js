/**
 * Easy Spaces Reservation Form Scripts
 * Handles client-side logic for reservation forms
 */

var EasySpaces = EasySpaces || {};
EasySpaces.Reservation = EasySpaces.Reservation || {};

(function () {
    /**
     * Form OnLoad event handler
     */
    this.onLoad = function (executionContext) {
        var formContext = executionContext.getFormContext();
        
        // Set defaults for new records
        if (formContext.ui.getFormType() === 1) { // Create form
            setDefaults(formContext);
        }
        
        // Register event handlers
        registerEventHandlers(formContext);
        
        // Apply business rules
        applyBusinessRules(formContext);
        
        // Show/hide sections based on status
        toggleSectionsByStatus(formContext);
    };
    
    /**
     * Form OnSave event handler
     */
    this.onSave = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var eventArgs = executionContext.getEventArgs();
        
        // Validate reservation
        if (!validateReservation(formContext)) {
            eventArgs.preventDefault();
            return;
        }
        
        // Calculate totals
        calculateTotals(formContext);
    };
    
    /**
     * Space field OnChange event handler
     */
    this.onSpaceChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var spaceRef = formContext.getAttribute("es_spaceid").getValue();
        
        if (spaceRef && spaceRef.length > 0) {
            // Retrieve space details and update pricing
            Xrm.WebApi.retrieveRecord("es_space", spaceRef[0].id, "?$select=es_dailyrate,es_hourlyrate,es_mincapacity,es_maxcapacity,es_requiresapproval").then(
                function (space) {
                    // Update pricing fields
                    updatePricing(formContext, space);
                    
                    // Set capacity constraints
                    setCapacityConstraints(formContext, space);
                    
                    // Show approval section if required
                    if (space.es_requiresapproval) {
                        showApprovalSection(formContext);
                    }
                },
                function (error) {
                    console.error("Error retrieving space details: " + error.message);
                }
            );
        }
    };
    
    /**
     * Date field OnChange event handler
     */
    this.onDateChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var startDate = formContext.getAttribute("es_startdate").getValue();
        var endDate = formContext.getAttribute("es_enddate").getValue();
        
        if (startDate && endDate) {
            // Validate dates
            if (endDate <= startDate) {
                formContext.ui.setFormNotification("End date must be after start date", "ERROR", "DATE_VALIDATION");
                formContext.getAttribute("es_enddate").setValue(null);
                return;
            } else {
                formContext.ui.clearFormNotification("DATE_VALIDATION");
            }
            
            // Calculate duration
            var duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            formContext.getAttribute("es_duration").setValue(duration);
            
            // Recalculate total amount
            calculateTotalAmount(formContext);
            
            // Check availability
            checkSpaceAvailability(formContext);
        }
    };
    
    /**
     * Number of guests OnChange event handler
     */
    this.onGuestCountChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var guestCount = formContext.getAttribute("es_numberofguests").getValue();
        var spaceRef = formContext.getAttribute("es_spaceid").getValue();
        
        if (guestCount && spaceRef && spaceRef.length > 0) {
            // Validate against space capacity
            Xrm.WebApi.retrieveRecord("es_space", spaceRef[0].id, "?$select=es_mincapacity,es_maxcapacity").then(
                function (space) {
                    if (guestCount < space.es_mincapacity || guestCount > space.es_maxcapacity) {
                        formContext.ui.setFormNotification(
                            "Number of guests must be between " + space.es_mincapacity + " and " + space.es_maxcapacity,
                            "WARNING",
                            "CAPACITY_WARNING"
                        );
                    } else {
                        formContext.ui.clearFormNotification("CAPACITY_WARNING");
                    }
                },
                function (error) {
                    console.error("Error validating capacity: " + error.message);
                }
            );
        }
    };
    
    /**
     * Status field OnChange event handler
     */
    this.onStatusChange = function (executionContext) {
        var formContext = executionContext.getFormContext();
        var status = formContext.getAttribute("es_status").getValue();
        
        // Show/hide sections based on status
        toggleSectionsByStatus(formContext);
        
        // Lock fields for confirmed reservations
        if (status >= 3) { // Confirmed or higher
            lockCriticalFields(formContext);
        }
        
        // Set cancellation date if cancelled
        if (status === 6) { // Cancelled
            formContext.getAttribute("es_cancellationdate").setValue(new Date());
            formContext.getAttribute("es_cancellationreason").setRequiredLevel("required");
        }
    };
    
    // Private helper functions
    
    function setDefaults(formContext) {
        // Set default status
        formContext.getAttribute("es_status").setValue(1); // Draft
        
        // Set default number of guests
        formContext.getAttribute("es_numberofguests").setValue(1);
        
        // Set default dates (tomorrow to day after)
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        
        var dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);
        dayAfter.setHours(17, 0, 0, 0);
        
        formContext.getAttribute("es_startdate").setValue(tomorrow);
        formContext.getAttribute("es_enddate").setValue(dayAfter);
    }
    
    function registerEventHandlers(formContext) {
        // Register field change handlers
        formContext.getAttribute("es_spaceid").addOnChange(EasySpaces.Reservation.onSpaceChange);
        formContext.getAttribute("es_startdate").addOnChange(EasySpaces.Reservation.onDateChange);
        formContext.getAttribute("es_enddate").addOnChange(EasySpaces.Reservation.onDateChange);
        formContext.getAttribute("es_numberofguests").addOnChange(EasySpaces.Reservation.onGuestCountChange);
        formContext.getAttribute("es_status").addOnChange(EasySpaces.Reservation.onStatusChange);
        formContext.getAttribute("es_depositamount").addOnChange(calculateBalanceDue);
    }
    
    function applyBusinessRules(formContext) {
        var formType = formContext.ui.getFormType();
        
        // Disable auto-generated fields
        formContext.getControl("es_name").setDisabled(true);
        formContext.getControl("es_confirmationcode").setDisabled(true);
        formContext.getControl("es_duration").setDisabled(true);
        formContext.getControl("es_balancedue").setDisabled(true);
        
        // Hide cancellation fields initially
        if (formType === 1) { // Create
            formContext.ui.tabs.get("GENERAL_TAB").sections.get("CANCELLATION_SECTION").setVisible(false);
        }
    }
    
    function toggleSectionsByStatus(formContext) {
        var status = formContext.getAttribute("es_status").getValue();
        
        if (status === 6) { // Cancelled
            formContext.ui.tabs.get("GENERAL_TAB").sections.get("CANCELLATION_SECTION").setVisible(true);
        } else {
            formContext.ui.tabs.get("GENERAL_TAB").sections.get("CANCELLATION_SECTION").setVisible(false);
        }
        
        if (status === 2) { // Pending Approval
            formContext.ui.tabs.get("GENERAL_TAB").sections.get("APPROVAL_SECTION").setVisible(true);
        } else {
            formContext.ui.tabs.get("GENERAL_TAB").sections.get("APPROVAL_SECTION").setVisible(false);
        }
    }
    
    function validateReservation(formContext) {
        var isValid = true;
        var errorMessages = [];
        
        // Validate required fields
        var requiredFields = ["es_spaceid", "es_customercontactid", "es_startdate", "es_enddate", "es_numberofguests"];
        requiredFields.forEach(function(fieldName) {
            var value = formContext.getAttribute(fieldName).getValue();
            if (!value) {
                errorMessages.push("Please fill in all required fields");
                isValid = false;
            }
        });
        
        // Validate dates
        var startDate = formContext.getAttribute("es_startdate").getValue();
        var endDate = formContext.getAttribute("es_enddate").getValue();
        
        if (startDate && endDate) {
            if (endDate <= startDate) {
                errorMessages.push("End date must be after start date");
                isValid = false;
            }
            
            if (startDate < new Date()) {
                errorMessages.push("Start date cannot be in the past");
                isValid = false;
            }
        }
        
        // Show errors
        if (!isValid) {
            formContext.ui.setFormNotification(errorMessages.join(". "), "ERROR", "VALIDATION_ERROR");
        } else {
            formContext.ui.clearFormNotification("VALIDATION_ERROR");
        }
        
        return isValid;
    }
    
    function calculateTotals(formContext) {
        calculateTotalAmount(formContext);
        calculateBalanceDue(formContext);
    }
    
    function calculateTotalAmount(formContext) {
        var duration = formContext.getAttribute("es_duration").getValue();
        var spaceRef = formContext.getAttribute("es_spaceid").getValue();
        
        if (duration && spaceRef && spaceRef.length > 0) {
            Xrm.WebApi.retrieveRecord("es_space", spaceRef[0].id, "?$select=es_dailyrate,es_weeklyrate,es_monthlyrate").then(
                function (space) {
                    var totalAmount = 0;
                    
                    if (duration >= 30 && space.es_monthlyrate) {
                        var months = Math.floor(duration / 30);
                        var remainingDays = duration % 30;
                        totalAmount = (months * space.es_monthlyrate) + (remainingDays * space.es_dailyrate);
                    } else if (duration >= 7 && space.es_weeklyrate) {
                        var weeks = Math.floor(duration / 7);
                        var remainingDays = duration % 7;
                        totalAmount = (weeks * space.es_weeklyrate) + (remainingDays * space.es_dailyrate);
                    } else {
                        totalAmount = duration * space.es_dailyrate;
                    }
                    
                    formContext.getAttribute("es_totalamount").setValue(totalAmount);
                    calculateBalanceDue(formContext);
                },
                function (error) {
                    console.error("Error calculating total amount: " + error.message);
                }
            );
        }
    }
    
    function calculateBalanceDue(formContext) {
        var totalAmount = formContext.getAttribute("es_totalamount").getValue() || 0;
        var depositAmount = formContext.getAttribute("es_depositamount").getValue() || 0;
        
        var balanceDue = totalAmount - depositAmount;
        formContext.getAttribute("es_balancedue").setValue(balanceDue);
        
        // Update payment status
        if (depositAmount >= totalAmount && totalAmount > 0) {
            formContext.getAttribute("es_paymentstatus").setValue(3); // Fully Paid
        } else if (depositAmount > 0) {
            formContext.getAttribute("es_paymentstatus").setValue(2); // Deposit Paid
        } else {
            formContext.getAttribute("es_paymentstatus").setValue(1); // Pending
        }
    }
    
    function updatePricing(formContext, space) {
        // Store pricing info for calculations
        formContext.data.entity.attributes.get("es_dailyrate_temp").setValue(space.es_dailyrate);
        
        // Show pricing info to user
        formContext.ui.setFormNotification(
            "Daily Rate: $" + space.es_dailyrate + " | Hourly Rate: $" + space.es_hourlyrate,
            "INFO",
            "PRICING_INFO"
        );
    }
    
    function setCapacityConstraints(formContext, space) {
        var guestControl = formContext.getControl("es_numberofguests");
        
        // Set tooltip with capacity info
        guestControl.setLabel("Number of Guests (Min: " + space.es_mincapacity + ", Max: " + space.es_maxcapacity + ")");
    }
    
    function showApprovalSection(formContext) {
        formContext.ui.tabs.get("GENERAL_TAB").sections.get("APPROVAL_SECTION").setVisible(true);
        formContext.ui.setFormNotification(
            "This space requires approval. Your reservation will be reviewed by our team.",
            "INFO",
            "APPROVAL_REQUIRED"
        );
    }
    
    function checkSpaceAvailability(formContext) {
        var spaceRef = formContext.getAttribute("es_spaceid").getValue();
        var startDate = formContext.getAttribute("es_startdate").getValue();
        var endDate = formContext.getAttribute("es_enddate").getValue();
        
        if (!spaceRef || spaceRef.length === 0 || !startDate || !endDate) {
            return;
        }
        
        // Build FetchXML query to check for conflicts
        var fetchXml = [
            "<fetch>",
            "  <entity name='es_reservation'>",
            "    <attribute name='es_name' />",
            "    <filter>",
            "      <condition attribute='es_spaceid' operator='eq' value='" + spaceRef[0].id + "' />",
            "      <condition attribute='es_status' operator='ne' value='6' />", // Not cancelled
            "      <filter type='or'>",
            "        <filter type='and'>",
            "          <condition attribute='es_startdate' operator='ge' value='" + startDate.toISOString() + "' />",
            "          <condition attribute='es_startdate' operator='lt' value='" + endDate.toISOString() + "' />",
            "        </filter>",
            "        <filter type='and'>",
            "          <condition attribute='es_enddate' operator='gt' value='" + startDate.toISOString() + "' />",
            "          <condition attribute='es_enddate' operator='le' value='" + endDate.toISOString() + "' />",
            "        </filter>",
            "      </filter>",
            "    </filter>",
            "  </entity>",
            "</fetch>"
        ].join("");
        
        Xrm.WebApi.retrieveMultipleRecords("es_reservation", "?fetchXml=" + encodeURIComponent(fetchXml)).then(
            function (result) {
                if (result.entities.length > 0) {
                    formContext.ui.setFormNotification(
                        "Warning: This space has conflicting reservations for the selected dates",
                        "WARNING",
                        "AVAILABILITY_WARNING"
                    );
                } else {
                    formContext.ui.clearFormNotification("AVAILABILITY_WARNING");
                    formContext.ui.setFormNotification(
                        "Space is available for the selected dates",
                        "INFO",
                        "AVAILABILITY_INFO"
                    );
                }
            },
            function (error) {
                console.error("Error checking availability: " + error.message);
            }
        );
    }
    
    function lockCriticalFields(formContext) {
        var fieldsToLock = ["es_spaceid", "es_startdate", "es_enddate", "es_numberofguests"];
        fieldsToLock.forEach(function(fieldName) {
            var control = formContext.getControl(fieldName);
            if (control) {
                control.setDisabled(true);
            }
        });
        
        formContext.ui.setFormNotification(
            "This reservation is confirmed. Contact support to make changes.",
            "INFO",
            "LOCKED_FIELDS"
        );
    }
    
}).call(EasySpaces.Reservation);