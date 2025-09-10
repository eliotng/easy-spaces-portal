using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace EasySpaces.Plugins
{
    /// <summary>
    /// Updates space statistics when reservations are created, updated, or deleted
    /// </summary>
    public class SpaceReservationStatsPlugin : PluginBase
    {
        public SpaceReservationStatsPlugin() : base(typeof(SpaceReservationStatsPlugin))
        {
            // Register for Post-Create
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                40, // Post-Operation
                "Create",
                "es_reservation",
                ExecuteStatsUpdate));

            // Register for Post-Update
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                40, // Post-Operation
                "Update",
                "es_reservation",
                ExecuteStatsUpdate));

            // Register for Pre-Delete (to capture pre-image)
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation
                "Delete",
                "es_reservation",
                ExecuteStatsUpdate));
        }

        private void ExecuteStatsUpdate(LocalPluginContext localContext)
        {
            var context = localContext.PluginExecutionContext;
            var service = localContext.OrganizationService;
            var trace = localContext.TracingService;

            trace.Trace("SpaceReservationStatsPlugin: Starting execution");

            Entity reservation = null;
            EntityReference spaceRef = null;

            // Get the reservation entity based on the message
            switch (context.MessageName.ToLower())
            {
                case "create":
                    reservation = context.InputParameters["Target"] as Entity;
                    spaceRef = reservation?.GetAttributeValue<EntityReference>("es_spaceid");
                    break;

                case "update":
                    reservation = context.InputParameters["Target"] as Entity;
                    if (context.PostEntityImages.Contains("PostImage"))
                    {
                        var postImage = context.PostEntityImages["PostImage"];
                        spaceRef = postImage.GetAttributeValue<EntityReference>("es_spaceid");
                    }
                    break;

                case "delete":
                    if (context.PreEntityImages.Contains("PreImage"))
                    {
                        var preImage = context.PreEntityImages["PreImage"];
                        spaceRef = preImage.GetAttributeValue<EntityReference>("es_spaceid");
                    }
                    break;
            }

            if (spaceRef == null)
            {
                trace.Trace("No space reference found, exiting");
                return;
            }

            trace.Trace($"Updating statistics for space: {spaceRef.Id}");

            try
            {
                // Calculate space statistics
                var stats = CalculateSpaceStatistics(service, spaceRef.Id, trace);

                // Update space record
                var spaceUpdate = new Entity("es_space", spaceRef.Id);
                spaceUpdate["es_totalreservations"] = stats.TotalReservations;
                spaceUpdate["es_totalrevenue"] = new Money(stats.TotalRevenue);
                spaceUpdate["es_occupancyrate"] = stats.OccupancyRate;
                spaceUpdate["es_averagerevenueperday"] = new Money(stats.AverageRevenuePerDay);
                spaceUpdate["es_lastreservationdate"] = stats.LastReservationDate;
                spaceUpdate["es_nextavailabledate"] = stats.NextAvailableDate;

                service.Update(spaceUpdate);
                trace.Trace("Space statistics updated successfully");

                // Update market statistics if needed
                UpdateMarketStatistics(service, spaceRef.Id, trace);
            }
            catch (Exception ex)
            {
                trace.Trace($"Error updating space statistics: {ex.Message}");
                throw new InvalidPluginExecutionException($"Failed to update space statistics: {ex.Message}", ex);
            }
        }

        private SpaceStatistics CalculateSpaceStatistics(IOrganizationService service, Guid spaceId, ITracingService trace)
        {
            var stats = new SpaceStatistics();
            var today = DateTime.UtcNow.Date;
            var thirtyDaysAgo = today.AddDays(-30);

            // Get all confirmed/completed reservations for this space
            var reservationQuery = new QueryExpression("es_reservation")
            {
                ColumnSet = new ColumnSet("es_totalamount", "es_startdate", "es_enddate", "es_status"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("es_spaceid", ConditionOperator.Equal, spaceId),
                        new ConditionExpression("es_status", ConditionOperator.In, 3, 4, 5), // Confirmed, In Progress, Completed
                        new ConditionExpression("statecode", ConditionOperator.Equal, 0) // Active
                    }
                }
            };

            var reservations = service.RetrieveMultiple(reservationQuery);
            
            stats.TotalReservations = reservations.Entities.Count;
            
            if (stats.TotalReservations > 0)
            {
                // Calculate total revenue
                stats.TotalRevenue = reservations.Entities
                    .Where(r => r.Contains("es_totalamount"))
                    .Sum(r => r.GetAttributeValue<Money>("es_totalamount")?.Value ?? 0);

                // Get last reservation date
                stats.LastReservationDate = reservations.Entities
                    .Where(r => r.Contains("es_startdate"))
                    .Select(r => r.GetAttributeValue<DateTime>("es_startdate"))
                    .OrderByDescending(d => d)
                    .FirstOrDefault();

                // Calculate occupancy rate for last 30 days
                var recentReservations = reservations.Entities
                    .Where(r => r.GetAttributeValue<DateTime>("es_startdate") >= thirtyDaysAgo)
                    .ToList();

                if (recentReservations.Any())
                {
                    var totalDaysBooked = 0;
                    foreach (var res in recentReservations)
                    {
                        var start = res.GetAttributeValue<DateTime>("es_startdate");
                        var end = res.GetAttributeValue<DateTime>("es_enddate");
                        
                        // Adjust dates to 30-day window
                        if (start < thirtyDaysAgo) start = thirtyDaysAgo;
                        if (end > today) end = today;
                        
                        totalDaysBooked += (int)(end - start).TotalDays;
                    }

                    stats.OccupancyRate = (decimal)totalDaysBooked / 30 * 100;
                }

                // Calculate average revenue per day
                if (stats.TotalRevenue > 0)
                {
                    var firstReservation = reservations.Entities
                        .Where(r => r.Contains("es_startdate"))
                        .Select(r => r.GetAttributeValue<DateTime>("es_startdate"))
                        .OrderBy(d => d)
                        .FirstOrDefault();

                    var daysSinceFirst = (int)(today - firstReservation).TotalDays;
                    if (daysSinceFirst > 0)
                    {
                        stats.AverageRevenuePerDay = stats.TotalRevenue / daysSinceFirst;
                    }
                }
            }

            // Calculate next available date
            var futureReservationsQuery = new QueryExpression("es_reservation")
            {
                TopCount = 10,
                ColumnSet = new ColumnSet("es_startdate", "es_enddate"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("es_spaceid", ConditionOperator.Equal, spaceId),
                        new ConditionExpression("es_status", ConditionOperator.In, 2, 3, 4), // Pending, Confirmed, In Progress
                        new ConditionExpression("es_enddate", ConditionOperator.GreaterEqual, today),
                        new ConditionExpression("statecode", ConditionOperator.Equal, 0)
                    }
                },
                Orders =
                {
                    new OrderExpression("es_startdate", OrderType.Ascending)
                }
            };

            var futureReservations = service.RetrieveMultiple(futureReservationsQuery);
            
            if (futureReservations.Entities.Count > 0)
            {
                var nextAvailable = today.AddDays(1);
                foreach (var res in futureReservations.Entities.OrderBy(r => r.GetAttributeValue<DateTime>("es_startdate")))
                {
                    var start = res.GetAttributeValue<DateTime>("es_startdate");
                    var end = res.GetAttributeValue<DateTime>("es_enddate");
                    
                    if (nextAvailable < start)
                    {
                        stats.NextAvailableDate = nextAvailable;
                        break;
                    }
                    
                    nextAvailable = end.AddDays(1);
                }
                
                if (!stats.NextAvailableDate.HasValue)
                {
                    stats.NextAvailableDate = nextAvailable;
                }
            }
            else
            {
                stats.NextAvailableDate = today.AddDays(1);
            }

            trace.Trace($"Statistics calculated - Reservations: {stats.TotalReservations}, Revenue: {stats.TotalRevenue}, Occupancy: {stats.OccupancyRate}%");
            
            return stats;
        }

        private void UpdateMarketStatistics(IOrganizationService service, Guid spaceId, ITracingService trace)
        {
            try
            {
                // Get the market for this space
                var space = service.Retrieve("es_space", spaceId, new ColumnSet("es_marketid"));
                var marketRef = space.GetAttributeValue<EntityReference>("es_marketid");
                
                if (marketRef == null)
                {
                    trace.Trace("No market reference found for space");
                    return;
                }

                // Calculate market-wide statistics
                var spaceQuery = new QueryExpression("es_space")
                {
                    ColumnSet = new ColumnSet("es_totalrevenue", "es_totalreservations", "es_occupancyrate"),
                    Criteria = new FilterExpression
                    {
                        Conditions =
                        {
                            new ConditionExpression("es_marketid", ConditionOperator.Equal, marketRef.Id),
                            new ConditionExpression("statecode", ConditionOperator.Equal, 0)
                        }
                    }
                };

                var spaces = service.RetrieveMultiple(spaceQuery);
                
                var totalMarketRevenue = spaces.Entities
                    .Where(s => s.Contains("es_totalrevenue"))
                    .Sum(s => s.GetAttributeValue<Money>("es_totalrevenue")?.Value ?? 0);
                
                var totalMarketReservations = spaces.Entities
                    .Where(s => s.Contains("es_totalreservations"))
                    .Sum(s => s.GetAttributeValue<int>("es_totalreservations"));
                
                var avgOccupancy = spaces.Entities
                    .Where(s => s.Contains("es_occupancyrate"))
                    .Average(s => s.GetAttributeValue<decimal?>("es_occupancyrate") ?? 0);

                // Update market record
                var marketUpdate = new Entity("es_market", marketRef.Id);
                marketUpdate["es_totalrevenue"] = new Money(totalMarketRevenue);
                marketUpdate["es_totalreservations"] = totalMarketReservations;
                marketUpdate["es_averageoccupancy"] = avgOccupancy;
                marketUpdate["es_lastcalculationdate"] = DateTime.UtcNow;

                service.Update(marketUpdate);
                trace.Trace($"Market statistics updated for market {marketRef.Id}");
            }
            catch (Exception ex)
            {
                trace.Trace($"Error updating market statistics: {ex.Message}");
                // Don't throw - market update is not critical
            }
        }

        private class SpaceStatistics
        {
            public int TotalReservations { get; set; }
            public decimal TotalRevenue { get; set; }
            public decimal OccupancyRate { get; set; }
            public decimal AverageRevenuePerDay { get; set; }
            public DateTime? LastReservationDate { get; set; }
            public DateTime? NextAvailableDate { get; set; }
        }
    }
}