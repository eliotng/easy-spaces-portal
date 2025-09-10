using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace EasySpaces.Plugins
{
    /// <summary>
    /// Detects and prevents duplicate reservations for the same space and time period
    /// </summary>
    public class DuplicateReservationDetectionPlugin : PluginBase
    {
        public DuplicateReservationDetectionPlugin() : base(typeof(DuplicateReservationDetectionPlugin))
        {
            // Register for Pre-Create
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation
                "Create",
                "es_reservation",
                ExecuteDuplicateDetection));

            // Register for Pre-Update
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation
                "Update",
                "es_reservation",
                ExecuteDuplicateDetection));
        }

        private void ExecuteDuplicateDetection(LocalPluginContext localContext)
        {
            var context = localContext.PluginExecutionContext;
            var service = localContext.OrganizationService;
            var trace = localContext.TracingService;

            trace.Trace("DuplicateReservationDetectionPlugin: Starting execution");

            if (context.InputParameters.Contains("Target") && context.InputParameters["Target"] is Entity)
            {
                Entity reservation = (Entity)context.InputParameters["Target"];
                
                // Get required fields
                EntityReference spaceRef = null;
                DateTime? startDate = null;
                DateTime? endDate = null;
                EntityReference customerRef = null;
                EntityReference leadRef = null;
                Guid currentReservationId = Guid.Empty;

                // For updates, get the reservation ID
                if (context.MessageName.ToLower() == "update")
                {
                    currentReservationId = reservation.Id;
                    
                    // Get values from pre-image if not in target
                    if (context.PreEntityImages.Contains("PreImage"))
                    {
                        var preImage = context.PreEntityImages["PreImage"];
                        spaceRef = reservation.GetAttributeValue<EntityReference>("es_spaceid") ?? 
                                  preImage.GetAttributeValue<EntityReference>("es_spaceid");
                        startDate = reservation.GetAttributeValue<DateTime?>("es_startdate") ?? 
                                   preImage.GetAttributeValue<DateTime?>("es_startdate");
                        endDate = reservation.GetAttributeValue<DateTime?>("es_enddate") ?? 
                                 preImage.GetAttributeValue<DateTime?>("es_enddate");
                        customerRef = reservation.GetAttributeValue<EntityReference>("es_customercontactid") ?? 
                                     preImage.GetAttributeValue<EntityReference>("es_customercontactid");
                        leadRef = reservation.GetAttributeValue<EntityReference>("es_leadid") ?? 
                                 preImage.GetAttributeValue<EntityReference>("es_leadid");
                    }
                }
                else // Create
                {
                    spaceRef = reservation.GetAttributeValue<EntityReference>("es_spaceid");
                    startDate = reservation.GetAttributeValue<DateTime?>("es_startdate");
                    endDate = reservation.GetAttributeValue<DateTime?>("es_enddate");
                    customerRef = reservation.GetAttributeValue<EntityReference>("es_customercontactid");
                    leadRef = reservation.GetAttributeValue<EntityReference>("es_leadid");
                }

                // Check for overlapping reservations
                if (spaceRef != null && startDate.HasValue && endDate.HasValue)
                {
                    trace.Trace($"Checking for overlapping reservations for space {spaceRef.Id}");
                    CheckForOverlappingReservations(service, trace, spaceRef.Id, startDate.Value, endDate.Value, currentReservationId);
                }

                // Check for duplicate customer reservations
                if ((customerRef != null || leadRef != null) && startDate.HasValue && endDate.HasValue)
                {
                    trace.Trace("Checking for duplicate customer reservations");
                    CheckForDuplicateCustomerReservations(service, trace, customerRef, leadRef, startDate.Value, endDate.Value, currentReservationId);
                }

                // Check for suspicious patterns
                if (customerRef != null || leadRef != null)
                {
                    CheckForSuspiciousBookingPatterns(service, trace, customerRef, leadRef, startDate, currentReservationId);
                }
            }
        }

        private void CheckForOverlappingReservations(IOrganizationService service, ITracingService trace, 
            Guid spaceId, DateTime startDate, DateTime endDate, Guid currentReservationId)
        {
            // Build query to find overlapping reservations
            var query = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_name", "es_startdate", "es_enddate", "es_customercontactid", "es_status"),
                Criteria = new FilterExpression(LogicalOperator.And)
            };

            // Add space condition
            query.Criteria.AddCondition("es_spaceid", ConditionOperator.Equal, spaceId);
            
            // Exclude cancelled reservations
            query.Criteria.AddCondition("es_status", ConditionOperator.NotIn, 6); // Not Cancelled
            
            // Exclude current reservation (for updates)
            if (currentReservationId != Guid.Empty)
            {
                query.Criteria.AddCondition("es_reservationid", ConditionOperator.NotEqual, currentReservationId);
            }

            // Add active state condition
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);

            // Check for date overlap
            var dateFilter = new FilterExpression(LogicalOperator.Or);
            
            // Case 1: Existing reservation starts during new reservation
            var overlapFilter1 = new FilterExpression(LogicalOperator.And);
            overlapFilter1.AddCondition("es_startdate", ConditionOperator.GreaterEqual, startDate);
            overlapFilter1.AddCondition("es_startdate", ConditionOperator.LessThan, endDate);
            dateFilter.AddFilter(overlapFilter1);
            
            // Case 2: Existing reservation ends during new reservation
            var overlapFilter2 = new FilterExpression(LogicalOperator.And);
            overlapFilter2.AddCondition("es_enddate", ConditionOperator.GreaterThan, startDate);
            overlapFilter2.AddCondition("es_enddate", ConditionOperator.LessEqual, endDate);
            dateFilter.AddFilter(overlapFilter2);
            
            // Case 3: Existing reservation completely contains new reservation
            var overlapFilter3 = new FilterExpression(LogicalOperator.And);
            overlapFilter3.AddCondition("es_startdate", ConditionOperator.LessEqual, startDate);
            overlapFilter3.AddCondition("es_enddate", ConditionOperator.GreaterEqual, endDate);
            dateFilter.AddFilter(overlapFilter3);
            
            query.Criteria.AddFilter(dateFilter);

            var results = service.RetrieveMultiple(query);
            
            if (results.Entities.Count > 0)
            {
                var conflictingReservation = results.Entities[0];
                var resName = conflictingReservation.GetAttributeValue<string>("es_name");
                var resStart = conflictingReservation.GetAttributeValue<DateTime>("es_startdate");
                var resEnd = conflictingReservation.GetAttributeValue<DateTime>("es_enddate");
                
                throw new InvalidPluginExecutionException(
                    $"This space is already reserved for the selected time period. " +
                    $"Conflicting reservation: {resName} ({resStart:MMM dd, yyyy} - {resEnd:MMM dd, yyyy}). " +
                    $"Please select different dates or a different space.");
            }
            
            trace.Trace("No overlapping reservations found");
        }

        private void CheckForDuplicateCustomerReservations(IOrganizationService service, ITracingService trace,
            EntityReference customerRef, EntityReference leadRef, DateTime startDate, DateTime endDate, Guid currentReservationId)
        {
            var query = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_name", "es_spaceid", "es_startdate", "es_enddate"),
                Criteria = new FilterExpression(LogicalOperator.And)
            };

            // Add customer condition
            var customerFilter = new FilterExpression(LogicalOperator.Or);
            if (customerRef != null)
            {
                customerFilter.AddCondition("es_customercontactid", ConditionOperator.Equal, customerRef.Id);
            }
            if (leadRef != null)
            {
                customerFilter.AddCondition("es_leadid", ConditionOperator.Equal, leadRef.Id);
            }
            query.Criteria.AddFilter(customerFilter);

            // Exclude cancelled reservations
            query.Criteria.AddCondition("es_status", ConditionOperator.NotIn, 6);
            
            // Exclude current reservation
            if (currentReservationId != Guid.Empty)
            {
                query.Criteria.AddCondition("es_reservationid", ConditionOperator.NotEqual, currentReservationId);
            }

            // Check for date overlap
            var dateFilter = new FilterExpression(LogicalOperator.Or);
            dateFilter.AddCondition("es_startdate", ConditionOperator.Between, startDate, endDate);
            dateFilter.AddCondition("es_enddate", ConditionOperator.Between, startDate, endDate);
            
            var containsFilter = new FilterExpression(LogicalOperator.And);
            containsFilter.AddCondition("es_startdate", ConditionOperator.LessEqual, startDate);
            containsFilter.AddCondition("es_enddate", ConditionOperator.GreaterEqual, endDate);
            dateFilter.AddFilter(containsFilter);
            
            query.Criteria.AddFilter(dateFilter);

            var results = service.RetrieveMultiple(query);
            
            if (results.Entities.Count > 0)
            {
                var conflictingReservation = results.Entities[0];
                var resName = conflictingReservation.GetAttributeValue<string>("es_name");
                var space = conflictingReservation.GetAttributeValue<EntityReference>("es_spaceid");
                
                // Retrieve space name
                var spaceEntity = service.Retrieve("es_space", space.Id, new ColumnSet("es_name"));
                var spaceName = spaceEntity.GetAttributeValue<string>("es_name");
                
                trace.Trace($"Warning: Customer has overlapping reservation {resName} for space {spaceName}");
                
                // This is a warning, not necessarily an error - customer might legitimately book multiple spaces
                // You can decide whether to throw an exception or just log a warning
            }
        }

        private void CheckForSuspiciousBookingPatterns(IOrganizationService service, ITracingService trace,
            EntityReference customerRef, EntityReference leadRef, DateTime? startDate, Guid currentReservationId)
        {
            if (!startDate.HasValue) return;
            
            // Check for too many reservations in a short period
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
            
            var query = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_reservationid"),
                Criteria = new FilterExpression(LogicalOperator.And)
            };

            // Add customer condition
            var customerFilter = new FilterExpression(LogicalOperator.Or);
            if (customerRef != null)
            {
                customerFilter.AddCondition("es_customercontactid", ConditionOperator.Equal, customerRef.Id);
            }
            if (leadRef != null)
            {
                customerFilter.AddCondition("es_leadid", ConditionOperator.Equal, leadRef.Id);
            }
            query.Criteria.AddFilter(customerFilter);

            // Check recent reservations
            query.Criteria.AddCondition("createdon", ConditionOperator.GreaterEqual, thirtyDaysAgo);
            
            // Exclude current reservation
            if (currentReservationId != Guid.Empty)
            {
                query.Criteria.AddCondition("es_reservationid", ConditionOperator.NotEqual, currentReservationId);
            }

            var results = service.RetrieveMultiple(query);
            
            // Flag if customer has made more than 10 reservations in 30 days
            if (results.Entities.Count > 10)
            {
                trace.Trace($"Warning: Customer has made {results.Entities.Count} reservations in the last 30 days");
                
                // You could create a task for review or flag the reservation
                var task = new Entity("task");
                task["subject"] = "Review: High-frequency reservation pattern";
                task["description"] = $"Customer has made {results.Entities.Count} reservations in the last 30 days. Please review for potential issues.";
                task["regardingobjectid"] = new EntityReference("es_reservation", currentReservationId);
                task["scheduledend"] = DateTime.UtcNow.AddDays(1);
                task["prioritycode"] = new OptionSetValue(2); // High priority
                
                try
                {
                    service.Create(task);
                    trace.Trace("Review task created for high-frequency bookings");
                }
                catch (Exception ex)
                {
                    trace.Trace($"Could not create review task: {ex.Message}");
                }
            }

            // Check for last-minute cancellations pattern
            CheckCancellationPattern(service, trace, customerRef, leadRef);
        }

        private void CheckCancellationPattern(IOrganizationService service, ITracingService trace,
            EntityReference customerRef, EntityReference leadRef)
        {
            var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
            
            var query = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_status", "es_cancellationdate", "es_startdate"),
                Criteria = new FilterExpression(LogicalOperator.And)
            };

            // Add customer condition
            var customerFilter = new FilterExpression(LogicalOperator.Or);
            if (customerRef != null)
            {
                customerFilter.AddCondition("es_customercontactid", ConditionOperator.Equal, customerRef.Id);
            }
            if (leadRef != null)
            {
                customerFilter.AddCondition("es_leadid", ConditionOperator.Equal, leadRef.Id);
            }
            query.Criteria.AddFilter(customerFilter);

            // Get cancelled reservations
            query.Criteria.AddCondition("es_status", ConditionOperator.Equal, 6); // Cancelled
            query.Criteria.AddCondition("createdon", ConditionOperator.GreaterEqual, sixMonthsAgo);

            var results = service.RetrieveMultiple(query);
            
            if (results.Entities.Count > 0)
            {
                // Count last-minute cancellations (within 24 hours)
                var lastMinuteCancellations = results.Entities.Count(r =>
                {
                    var cancellationDate = r.GetAttributeValue<DateTime?>("es_cancellationdate");
                    var startDate = r.GetAttributeValue<DateTime>("es_startdate");
                    return cancellationDate.HasValue && (startDate - cancellationDate.Value).TotalHours < 24;
                });

                if (lastMinuteCancellations > 2)
                {
                    trace.Trace($"Warning: Customer has {lastMinuteCancellations} last-minute cancellations in the last 6 months");
                    
                    // Could implement stricter validation or require deposits for this customer
                }
            }
        }
    }
}