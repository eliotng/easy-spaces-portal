using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace EasySpaces.Plugins
{
    /// <summary>
    /// Plugin to manage space capacity and update market totals
    /// Handles aggregation of space counts and capacity calculations
    /// </summary>
    public class SpaceCapacityPlugin : PluginBase
    {
        public SpaceCapacityPlugin() : base(typeof(SpaceCapacityPlugin))
        {
            // Register for Space Create
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                40, // Post-Operation
                "Create",
                "es_space",
                ExecuteSpaceCapacityUpdate));

            // Register for Space Update
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                40, // Post-Operation
                "Update",
                "es_space",
                ExecuteSpaceCapacityUpdate));

            // Register for Space Delete
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                20, // Pre-Operation (to capture the market before deletion)
                "Delete",
                "es_space",
                ExecuteSpaceCapacityDelete));

            // Register for Space State Change
            RegisteredEvents.Add(new Tuple<int, string, string, Action<LocalPluginContext>>(
                40, // Post-Operation
                "SetState",
                "es_space",
                ExecuteSpaceCapacityUpdate));
        }

        private void ExecuteSpaceCapacityUpdate(LocalPluginContext localContext)
        {
            var context = localContext.PluginExecutionContext;
            var service = localContext.SystemOrganizationService; // Use system service for aggregation
            var trace = localContext.TracingService;

            trace.Trace("SpaceCapacityPlugin: Update Started");

            Entity space = null;
            EntityReference marketRef = null;

            // Get the space entity based on message
            if (context.MessageName == "Create" || context.MessageName == "Update")
            {
                space = context.InputParameters["Target"] as Entity;
            }
            else if (context.MessageName == "SetState")
            {
                var entityRef = context.InputParameters["EntityMoniker"] as EntityReference;
                space = service.Retrieve("es_space", entityRef.Id, new ColumnSet("es_marketid"));
            }

            // Get market reference
            if (space != null && space.Contains("es_marketid"))
            {
                marketRef = space.GetAttributeValue<EntityReference>("es_marketid");
            }
            else if (context.PostEntityImages.Contains("PostImage"))
            {
                var postImage = context.PostEntityImages["PostImage"];
                if (postImage.Contains("es_marketid"))
                {
                    marketRef = postImage.GetAttributeValue<EntityReference>("es_marketid");
                }
            }

            // Also check if market changed (for updates)
            if (context.MessageName == "Update" && context.PreEntityImages.Contains("PreImage"))
            {
                var preImage = context.PreEntityImages["PreImage"];
                if (preImage.Contains("es_marketid"))
                {
                    var oldMarketRef = preImage.GetAttributeValue<EntityReference>("es_marketid");
                    
                    // Update old market if it changed
                    if (oldMarketRef != null && (marketRef == null || oldMarketRef.Id != marketRef.Id))
                    {
                        UpdateMarketCapacity(service, oldMarketRef.Id, trace);
                    }
                }
            }

            // Update current market
            if (marketRef != null)
            {
                UpdateMarketCapacity(service, marketRef.Id, trace);
            }

            trace.Trace("SpaceCapacityPlugin: Update Completed");
        }

        private void ExecuteSpaceCapacityDelete(LocalPluginContext localContext)
        {
            var context = localContext.PluginExecutionContext;
            var service = localContext.SystemOrganizationService;
            var trace = localContext.TracingService;

            trace.Trace("SpaceCapacityPlugin: Delete Started");

            // Get the market from pre-image before deletion
            if (context.PreEntityImages.Contains("PreImage"))
            {
                var preImage = context.PreEntityImages["PreImage"];
                if (preImage.Contains("es_marketid"))
                {
                    var marketRef = preImage.GetAttributeValue<EntityReference>("es_marketid");
                    
                    // Store market ID for post-operation update
                    context.SharedVariables["MarketToUpdate"] = marketRef.Id.ToString();
                }
            }

            trace.Trace("SpaceCapacityPlugin: Delete Prepared");
        }

        private void UpdateMarketCapacity(IOrganizationService service, Guid marketId, ITracingService trace)
        {
            trace.Trace($"Updating market capacity for market: {marketId}");

            try
            {
                // Query all active spaces for this market
                var query = new QueryExpression("es_space")
                {
                    ColumnSet = new ColumnSet("es_maxcapacity", "es_status"),
                    Criteria = new FilterExpression(LogicalOperator.And)
                    {
                        Conditions =
                        {
                            new ConditionExpression("es_marketid", ConditionOperator.Equal, marketId),
                            new ConditionExpression("statecode", ConditionOperator.Equal, 0) // Active
                        }
                    }
                };

                var spaces = service.RetrieveMultiple(query);

                // Calculate totals
                int totalSpaces = 0;
                int totalCapacity = 0;
                int availableSpaces = 0;

                foreach (var space in spaces.Entities)
                {
                    totalSpaces++;

                    var maxCapacity = space.GetAttributeValue<int>("es_maxcapacity");
                    totalCapacity += maxCapacity;

                    var status = space.GetAttributeValue<OptionSetValue>("es_status");
                    if (status != null && status.Value == 1) // Available
                    {
                        availableSpaces++;
                    }
                }

                // Update market entity
                var marketUpdate = new Entity("es_market", marketId);
                marketUpdate["es_totalspaces"] = totalSpaces;
                marketUpdate["es_totalcapacity"] = totalCapacity;
                marketUpdate["es_availablespaces"] = availableSpaces;
                marketUpdate["es_lastupdated"] = DateTime.Now;

                service.Update(marketUpdate);

                trace.Trace($"Market updated - Total Spaces: {totalSpaces}, Total Capacity: {totalCapacity}, Available: {availableSpaces}");

                // Check if market should be set to inactive (no spaces)
                if (totalSpaces == 0)
                {
                    trace.Trace("No spaces in market, considering deactivation");
                    // Note: In production, you might want to send a notification instead of auto-deactivating
                }
            }
            catch (Exception ex)
            {
                trace.Trace($"Error updating market capacity: {ex.Message}");
                // Don't throw - we don't want to fail the space operation due to aggregation issues
            }
        }
    }

}