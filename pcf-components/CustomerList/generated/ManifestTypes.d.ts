/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    cardLayout: ComponentFramework.PropertyTypes.EnumProperty<"compact" | "expanded" | "detailed">;
    primaryColor: ComponentFramework.PropertyTypes.StringProperty;
    showReservationCount: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    showLastContact: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    enableQuickActions: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    maxCardsPerRow: ComponentFramework.PropertyTypes.WholeNumberProperty;
    customersDataSet: ComponentFramework.PropertyTypes.DataSet;
}
export interface IOutputs {
}
