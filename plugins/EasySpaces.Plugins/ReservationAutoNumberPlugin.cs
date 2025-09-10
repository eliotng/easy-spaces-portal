using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace EasySpaces.Plugins
{
    /// <summary>
    /// Plugin to handle auto-numbering for reservations
    /// Generates sequential reservation numbers with format RES-YYYYMM-XXXX
    /// </summary>
    public class ReservationAutoNumberPlugin : PluginBase
    {
        public ReservationAutoNumberPlugin() : base(typeof(ReservationAutoNumberPlugin))
        {
            // Register for Pre-Create to set the reservation number
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation
                "Create",
                "es_reservation",
                ExecuteAutoNumber));
        }

        private void ExecuteAutoNumber(LocalPluginContext localContext)
        {
            var context = localContext.PluginExecutionContext;
            var service = localContext.SystemOrganizationService; // Use system service for counter access
            var trace = localContext.TracingService;

            trace.Trace("ReservationAutoNumberPlugin: Started");

            // Get the target entity
            var reservation = context.InputParameters["Target"] as Entity;
            if (reservation == null)
            {
                trace.Trace("No target entity found");
                return;
            }

            // Check if reservation number is already set
            if (reservation.Contains("es_name") && !string.IsNullOrEmpty(reservation.GetAttributeValue<string>("es_name")))
            {
                trace.Trace("Reservation number already set, skipping auto-numbering");
                return;
            }

            // Generate the reservation number
            var reservationNumber = GenerateReservationNumber(service, trace);
            reservation["es_name"] = reservationNumber;

            trace.Trace($"Reservation number generated: {reservationNumber}");
            trace.Trace("ReservationAutoNumberPlugin: Completed");
        }

        private string GenerateReservationNumber(IOrganizationService service, ITracingService trace)
        {
            // Format: RES-YYYYMM-XXXX (e.g., RES-202501-0001)
            var currentDate = DateTime.Now;
            var yearMonth = currentDate.ToString("yyyyMM");
            var prefix = $"RES-{yearMonth}-";

            // Get the latest reservation number for the current month
            var query = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_name"),
                TopCount = 1,
                Criteria = new FilterExpression(LogicalOperator.And)
                {
                    Conditions =
                    {
                        new ConditionExpression("es_name", ConditionOperator.BeginsWith, prefix),
                        new ConditionExpression("createdon", ConditionOperator.GreaterEqual, 
                            new DateTime(currentDate.Year, currentDate.Month, 1))
                    }
                },
                Orders =
                {
                    new OrderExpression("es_name", OrderType.Descending)
                }
            };

            var results = service.RetrieveMultiple(query);

            int nextNumber = 1;

            if (results.Entities.Count > 0)
            {
                var lastReservation = results.Entities.First();
                var lastNumber = lastReservation.GetAttributeValue<string>("es_name");

                // Extract the number part (last 4 digits)
                if (!string.IsNullOrEmpty(lastNumber) && lastNumber.Length >= 4)
                {
                    var numberPart = lastNumber.Substring(lastNumber.Length - 4);
                    if (int.TryParse(numberPart, out int currentNumber))
                    {
                        nextNumber = currentNumber + 1;
                    }
                }
            }

            // Format the new reservation number
            var newReservationNumber = $"{prefix}{nextNumber:D4}";

            trace.Trace($"Generated reservation number: {newReservationNumber}");
            return newReservationNumber;
        }
    }

}