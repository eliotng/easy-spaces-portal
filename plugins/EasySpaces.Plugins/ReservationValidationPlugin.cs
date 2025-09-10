using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace EasySpaces.Plugins
{
    /// <summary>
    /// Plugin to validate reservations before creation or update
    /// Converts Lightning Flow logic: Space Design Flow and Reservation Validation
    /// </summary>
    public class ReservationValidationPlugin : PluginBase
    {
        public ReservationValidationPlugin() : base(typeof(ReservationValidationPlugin))
        {
            // Register for Pre-Create
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation
                "Create",
                "es_reservation",
                ExecuteReservationValidation));

            // Register for Pre-Update
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation
                "Update",
                "es_reservation",
                ExecuteReservationValidation));
        }

        private void ExecuteReservationValidation(LocalPluginContext localContext)
        {
            var context = localContext.PluginExecutionContext;
            var service = localContext.OrganizationService;
            var trace = localContext.TracingService;

            trace.Trace("ReservationValidationPlugin: Started");

            // Get the target entity
            Entity reservation = context.InputParameters.Contains("Target") ?
                context.InputParameters["Target"] as Entity : null;

            if (reservation == null)
            {
                trace.Trace("No target entity found");
                return;
            }

            // For updates, merge with pre-image to get complete entity
            if (context.MessageName == "Update" && context.PreEntityImages.Contains("PreImage"))
            {
                var preImage = context.PreEntityImages["PreImage"];
                reservation = MergeEntities(preImage, reservation);
            }

            // Perform validations
            ValidateReservationDates(reservation, trace);
            ValidateCapacity(reservation, service, trace);
            ValidateSpaceAvailability(reservation, service, trace);
            ValidateCustomerInformation(reservation, service, trace);
            CalculatePricing(reservation, service, trace);
            SetReservationStatus(reservation, trace);

            trace.Trace("ReservationValidationPlugin: Completed");
        }

        private void ValidateReservationDates(Entity reservation, ITracingService trace)
        {
            trace.Trace("Validating reservation dates");

            if (!reservation.Contains("es_startdate") || !reservation.Contains("es_enddate"))
            {
                throw new InvalidPluginExecutionException("Start date and end date are required for reservations.");
            }

            var startDate = reservation.GetAttributeValue<DateTime>("es_startdate");
            var endDate = reservation.GetAttributeValue<DateTime>("es_enddate");

            // Validate dates are in correct order
            if (startDate >= endDate)
            {
                throw new InvalidPluginExecutionException("End date must be after start date.");
            }

            // Validate dates are in the future (for new reservations)
            if (reservation.Id == Guid.Empty && startDate < DateTime.Now.Date)
            {
                throw new InvalidPluginExecutionException("Reservation start date must be in the future.");
            }

            // Validate maximum reservation period (30 days)
            var duration = (endDate - startDate).TotalDays;
            if (duration > 30)
            {
                throw new InvalidPluginExecutionException("Reservations cannot exceed 30 days.");
            }

            // Set duration field
            reservation["es_duration"] = (decimal)duration;
        }

        private void ValidateCapacity(Entity reservation, IOrganizationService service, ITracingService trace)
        {
            trace.Trace("Validating capacity requirements");

            if (!reservation.Contains("es_spaceid"))
            {
                throw new InvalidPluginExecutionException("A space must be selected for the reservation.");
            }

            if (!reservation.Contains("es_numberofguests"))
            {
                throw new InvalidPluginExecutionException("Number of guests is required.");
            }

            var spaceRef = reservation.GetAttributeValue<EntityReference>("es_spaceid");
            var numberOfGuests = reservation.GetAttributeValue<int>("es_numberofguests");

            // Retrieve space capacity information
            var space = service.Retrieve("es_space", spaceRef.Id, 
                new ColumnSet("es_mincapacity", "es_maxcapacity", "es_name", "es_status"));

            var minCapacity = space.GetAttributeValue<int>("es_mincapacity");
            var maxCapacity = space.GetAttributeValue<int>("es_maxcapacity");
            var spaceName = space.GetAttributeValue<string>("es_name");

            // Check space status
            var spaceStatus = space.GetAttributeValue<OptionSetValue>("es_status");
            if (spaceStatus != null && spaceStatus.Value != 1) // 1 = Available
            {
                throw new InvalidPluginExecutionException($"The space '{spaceName}' is not available for reservation.");
            }

            // Validate capacity
            if (numberOfGuests < minCapacity)
            {
                throw new InvalidPluginExecutionException(
                    $"The space '{spaceName}' requires a minimum of {minCapacity} guests. You have {numberOfGuests} guests.");
            }

            if (numberOfGuests > maxCapacity)
            {
                throw new InvalidPluginExecutionException(
                    $"The space '{spaceName}' has a maximum capacity of {maxCapacity} guests. You have {numberOfGuests} guests.");
            }
        }

        private void ValidateSpaceAvailability(Entity reservation, IOrganizationService service, ITracingService trace)
        {
            trace.Trace("Validating space availability");

            var spaceRef = reservation.GetAttributeValue<EntityReference>("es_spaceid");
            var startDate = reservation.GetAttributeValue<DateTime>("es_startdate");
            var endDate = reservation.GetAttributeValue<DateTime>("es_enddate");
            var currentReservationId = reservation.Id;

            // Query for overlapping reservations
            var query = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_name", "es_startdate", "es_enddate"),
                Criteria = new FilterExpression(LogicalOperator.And)
                {
                    Conditions =
                    {
                        new ConditionExpression("es_spaceid", ConditionOperator.Equal, spaceRef.Id),
                        new ConditionExpression("es_status", ConditionOperator.In, 2, 3, 4), // Pending, Confirmed, In Progress
                        new ConditionExpression("statecode", ConditionOperator.Equal, 0) // Active
                    }
                }
            };

            // Exclude current reservation if updating
            if (currentReservationId != Guid.Empty)
            {
                query.Criteria.Conditions.Add(
                    new ConditionExpression("es_reservationid", ConditionOperator.NotEqual, currentReservationId));
            }

            // Add date overlap conditions
            var dateFilter = new FilterExpression(LogicalOperator.Or);
            
            // Case 1: Existing reservation starts during new reservation
            var filter1 = new FilterExpression(LogicalOperator.And);
            filter1.Conditions.Add(new ConditionExpression("es_startdate", ConditionOperator.GreaterEqual, startDate));
            filter1.Conditions.Add(new ConditionExpression("es_startdate", ConditionOperator.LessThan, endDate));
            dateFilter.AddFilter(filter1);

            // Case 2: Existing reservation ends during new reservation
            var filter2 = new FilterExpression(LogicalOperator.And);
            filter2.Conditions.Add(new ConditionExpression("es_enddate", ConditionOperator.GreaterThan, startDate));
            filter2.Conditions.Add(new ConditionExpression("es_enddate", ConditionOperator.LessEqual, endDate));
            dateFilter.AddFilter(filter2);

            // Case 3: Existing reservation completely overlaps new reservation
            var filter3 = new FilterExpression(LogicalOperator.And);
            filter3.Conditions.Add(new ConditionExpression("es_startdate", ConditionOperator.LessEqual, startDate));
            filter3.Conditions.Add(new ConditionExpression("es_enddate", ConditionOperator.GreaterEqual, endDate));
            dateFilter.AddFilter(filter3);

            query.Criteria.AddFilter(dateFilter);

            var overlappingReservations = service.RetrieveMultiple(query);

            if (overlappingReservations.Entities.Count > 0)
            {
                var firstOverlap = overlappingReservations.Entities.First();
                var overlapName = firstOverlap.GetAttributeValue<string>("es_name");
                var overlapStart = firstOverlap.GetAttributeValue<DateTime>("es_startdate");
                var overlapEnd = firstOverlap.GetAttributeValue<DateTime>("es_enddate");

                throw new InvalidPluginExecutionException(
                    $"This space is already reserved from {overlapStart:MM/dd/yyyy} to {overlapEnd:MM/dd/yyyy} " +
                    $"(Reservation: {overlapName}). Please select different dates.");
            }
        }

        private void ValidateCustomerInformation(Entity reservation, IOrganizationService service, ITracingService trace)
        {
            trace.Trace("Validating customer information");

            // Check if either contact or lead is provided
            bool hasContact = reservation.Contains("es_customercontactid") && 
                             reservation.GetAttributeValue<EntityReference>("es_customercontactid") != null;
            bool hasLead = reservation.Contains("es_leadid") && 
                          reservation.GetAttributeValue<EntityReference>("es_leadid") != null;

            if (!hasContact && !hasLead)
            {
                throw new InvalidPluginExecutionException("A customer (Contact or Lead) must be specified for the reservation.");
            }

            // Validate that only one customer type is selected
            if (hasContact && hasLead)
            {
                throw new InvalidPluginExecutionException("Please select either a Contact or a Lead, not both.");
            }

            // If it's a lead, check if it should be converted
            if (hasLead)
            {
                var leadRef = reservation.GetAttributeValue<EntityReference>("es_leadid");
                var lead = service.Retrieve("lead", leadRef.Id, new ColumnSet("statecode", "statuscode"));
                
                var leadState = lead.GetAttributeValue<OptionSetValue>("statecode");
                if (leadState != null && leadState.Value != 0) // 0 = Open
                {
                    throw new InvalidPluginExecutionException("Cannot create reservation for a qualified or disqualified lead.");
                }
            }
        }

        private void CalculatePricing(Entity reservation, IOrganizationService service, ITracingService trace)
        {
            trace.Trace("Calculating pricing");

            if (!reservation.Contains("es_spaceid"))
                return;

            var spaceRef = reservation.GetAttributeValue<EntityReference>("es_spaceid");
            var startDate = reservation.GetAttributeValue<DateTime>("es_startdate");
            var endDate = reservation.GetAttributeValue<DateTime>("es_enddate");

            // Retrieve space pricing
            var space = service.Retrieve("es_space", spaceRef.Id, new ColumnSet("es_dailyrate"));
            var dailyRate = space.GetAttributeValue<Money>("es_dailyrate");

            if (dailyRate != null)
            {
                var duration = (decimal)(endDate - startDate).TotalDays;
                var totalAmount = dailyRate.Value * duration;

                reservation["es_totalamount"] = new Money(totalAmount);

                // Calculate deposit (25% of total)
                if (!reservation.Contains("es_depositamount"))
                {
                    var depositAmount = totalAmount * 0.25m;
                    reservation["es_depositamount"] = new Money(depositAmount);
                }

                // Calculate balance due
                var deposit = reservation.GetAttributeValue<Money>("es_depositamount")?.Value ?? 0;
                var balanceDue = totalAmount - deposit;
                reservation["es_balancedue"] = new Money(balanceDue);

                trace.Trace($"Pricing calculated - Total: {totalAmount}, Deposit: {deposit}, Balance: {balanceDue}");
            }
        }

        private void SetReservationStatus(Entity reservation, ITracingService trace)
        {
            trace.Trace("Setting reservation status");

            // If status is not set, default to Draft
            if (!reservation.Contains("es_status"))
            {
                reservation["es_status"] = new OptionSetValue(1); // Draft
                trace.Trace("Status set to Draft");
            }

            var status = reservation.GetAttributeValue<OptionSetValue>("es_status");

            // Auto-confirm if moving from Draft and all validations pass
            if (status.Value == 1) // Draft
            {
                // Check if space requires approval
                if (reservation.Contains("es_spaceid"))
                {
                    var spaceRef = reservation.GetAttributeValue<EntityReference>("es_spaceid");
                    // In a real implementation, we would check the space's approval requirements
                    // For now, auto-move to Pending Approval
                    reservation["es_status"] = new OptionSetValue(2); // Pending Approval
                    trace.Trace("Status changed to Pending Approval");
                }
            }

            // Set confirmation code for confirmed reservations
            if (status.Value == 3 && !reservation.Contains("es_confirmationcode")) // Confirmed
            {
                var confirmationCode = GenerateConfirmationCode();
                reservation["es_confirmationcode"] = confirmationCode;
                reservation["es_confirmationsentdate"] = DateTime.Now;
                trace.Trace($"Confirmation code generated: {confirmationCode}");
            }
        }

        private string GenerateConfirmationCode()
        {
            var random = new Random();
            var code = $"ES-{random.Next(100000, 999999)}";
            return code;
        }

        private Entity MergeEntities(Entity preImage, Entity target)
        {
            var merged = new Entity(target.LogicalName, target.Id);

            // First add all pre-image attributes
            foreach (var attr in preImage.Attributes)
            {
                merged[attr.Key] = attr.Value;
            }

            // Then override with target attributes
            foreach (var attr in target.Attributes)
            {
                merged[attr.Key] = attr.Value;
            }

            return merged;
        }
    }
}