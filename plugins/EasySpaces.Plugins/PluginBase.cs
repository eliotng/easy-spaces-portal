using System;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;

namespace EasySpaces.Plugins
{
    /// <summary>
    /// Base class for all plugins providing common functionality
    /// </summary>
    public abstract class PluginBase : IPlugin
    {
        protected class LocalPluginContext
        {
            internal IServiceProvider ServiceProvider { get; private set; }
            internal IOrganizationService OrganizationService { get; private set; }
            internal IOrganizationService SystemOrganizationService { get; private set; }
            internal IPluginExecutionContext PluginExecutionContext { get; private set; }
            internal ITracingService TracingService { get; private set; }

            internal LocalPluginContext(IServiceProvider serviceProvider)
            {
                if (serviceProvider == null)
                {
                    throw new ArgumentNullException(nameof(serviceProvider));
                }

                ServiceProvider = serviceProvider;
                PluginExecutionContext = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                TracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
                IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                OrganizationService = factory.CreateOrganizationService(PluginExecutionContext.UserId);
                SystemOrganizationService = factory.CreateOrganizationService(null);
            }

            internal void Trace(string message, params object[] args)
            {
                if (TracingService != null)
                {
                    var formattedMessage = string.Format(CultureInfo.InvariantCulture, message, args);
                    TracingService.Trace(formattedMessage);
                }
            }
        }

        private Collection<Tuple<int, string, string, Action<LocalPluginContext>>> registeredEvents;

        /// <summary>
        /// Gets the list of events that the plugin should fire on.
        /// </summary>
        protected Collection<Tuple<int, string, string, Action<LocalPluginContext>>> RegisteredEvents
        {
            get
            {
                if (registeredEvents == null)
                {
                    registeredEvents = new Collection<Tuple<int, string, string, Action<LocalPluginContext>>>();
                }
                return registeredEvents;
            }
        }

        /// <summary>
        /// Gets the name of the child class.
        /// </summary>
        protected string ChildClassName { get; private set; }

        /// <summary>
        /// Base constructor for all plugins
        /// </summary>
        internal PluginBase(Type childClassName)
        {
            ChildClassName = childClassName.ToString();
        }

        /// <summary>
        /// Main execution method for plugins
        /// </summary>
        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
            {
                throw new ArgumentNullException(nameof(serviceProvider));
            }

            var localContext = new LocalPluginContext(serviceProvider);

            localContext.Trace("Entered {0}.Execute()", ChildClassName);

            try
            {
                // Get the execution context
                var context = localContext.PluginExecutionContext;

                // Find the registered event
                var registeredEvent = RegisteredEvents.FirstOrDefault(e =>
                    e.Item1 == context.Stage &&
                    string.Equals(e.Item2, context.MessageName, StringComparison.InvariantCultureIgnoreCase) &&
                    string.Equals(e.Item3, context.PrimaryEntityName, StringComparison.InvariantCultureIgnoreCase));

                if (registeredEvent != null)
                {
                    localContext.Trace("Executing registered event handler");
                    registeredEvent.Item4(localContext);
                }
                else
                {
                    localContext.Trace("No registered event handler found for {0}, {1}, {2}",
                        context.Stage, context.MessageName, context.PrimaryEntityName);
                }
            }
            catch (FaultException<OrganizationServiceFault> ex)
            {
                localContext.Trace("Exception: {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    string.Format("An error occurred in the {0} plugin: {1}", ChildClassName, ex.Message), ex);
            }
            catch (Exception ex)
            {
                localContext.Trace("Exception: {0}", ex.ToString());
                throw;
            }
            finally
            {
                localContext.Trace("Exiting {0}.Execute()", ChildClassName);
            }
        }
    }
}