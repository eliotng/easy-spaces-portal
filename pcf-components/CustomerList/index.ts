import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface CustomerCard {
    id: string;
    name: string;
    email: string;
    phone: string;
    type: string;
    company?: string;
    reservationCount?: number;
    totalSpent?: number;
    lastContactDate?: Date;
    rating?: number;
    status?: string;
    imageUrl?: string;
}

export class CustomerList implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _customersContainer: HTMLDivElement;
    private _searchInput: HTMLInputElement;
    private _filterDropdown: HTMLSelectElement;
    private _customers: CustomerCard[] = [];
    private _selectedCustomerId: string | null = null;
    
    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = container;
        
        // Create main container
        const mainContainer = document.createElement("div");
        mainContainer.className = "customer-list-control";
        
        // Create header with search and filters
        const header = this.createHeader();
        mainContainer.appendChild(header);
        
        // Create customers container
        this._customersContainer = document.createElement("div");
        this._customersContainer.className = "customers-grid";
        this.updateGridLayout();
        mainContainer.appendChild(this._customersContainer);
        
        // Create loading indicator
        const loadingIndicator = document.createElement("div");
        loadingIndicator.className = "loading-indicator";
        loadingIndicator.innerHTML = '<div class="spinner"></div><span>Loading customers...</span>';
        loadingIndicator.id = "loadingIndicator";
        mainContainer.appendChild(loadingIndicator);
        
        // Add styles
        this.applyStyles();
        
        // Append to container
        this._container.appendChild(mainContainer);
        
        // Load customers
        this.loadCustomers();
    }
    
    /**
     * Create header with search and filters
     */
    private createHeader(): HTMLElement {
        const header = document.createElement("div");
        header.className = "customer-list-header";
        
        // Search bar
        const searchContainer = document.createElement("div");
        searchContainer.className = "search-container";
        
        this._searchInput = document.createElement("input");
        this._searchInput.type = "text";
        this._searchInput.placeholder = "Search customers...";
        this._searchInput.className = "search-input";
        this._searchInput.addEventListener("input", () => this.filterCustomers());
        
        searchContainer.appendChild(this._searchInput);
        
        // Filter dropdown
        const filterContainer = document.createElement("div");
        filterContainer.className = "filter-container";
        
        this._filterDropdown = document.createElement("select");
        this._filterDropdown.className = "filter-dropdown";
        this._filterDropdown.innerHTML = `
            <option value="all">All Customers</option>
            <option value="contact">Contacts</option>
            <option value="lead">Leads</option>
            <option value="account">Accounts</option>
            <option value="active">Active</option>
            <option value="vip">VIP</option>
        `;
        this._filterDropdown.addEventListener("change", () => this.filterCustomers());
        
        filterContainer.appendChild(this._filterDropdown);
        
        // Stats bar
        const statsBar = document.createElement("div");
        statsBar.className = "stats-bar";
        statsBar.id = "statsBar";
        
        header.appendChild(searchContainer);
        header.appendChild(filterContainer);
        header.appendChild(statsBar);
        
        return header;
    }
    
    /**
     * Load customers from Dataverse
     */
    private async loadCustomers(): Promise<void> {
        try {
            const dataset = this._context.parameters.customersDataSet;
            this._customers = [];
            
            // Load contacts
            if (dataset.sortedRecordIds.length > 0) {
                for (const recordId of dataset.sortedRecordIds) {
                    const record = dataset.records[recordId];
                    const customer: CustomerCard = {
                        id: record.getRecordId(),
                        name: record.getValue("fullname") as string || "Unknown",
                        email: record.getValue("emailaddress1") as string || "",
                        phone: record.getValue("mobilephone") as string || record.getValue("telephone1") as string || "",
                        type: "contact",
                        company: record.getValue("parentcustomerid") as string || "",
                        status: "active"
                    };
                    
                    // Get additional data using WebAPI if enabled
                    if (this._context.parameters.showReservationCount.raw === true) {
                        await this.loadCustomerStats(customer);
                    }
                    
                    this._customers.push(customer);
                }
            }
            
            // Hide loading indicator
            const loadingIndicator = document.getElementById("loadingIndicator");
            if (loadingIndicator) {
                loadingIndicator.style.display = "none";
            }
            
            // Render customers
            this.renderCustomers();
            this.updateStats();
            
        } catch (error) {
            console.error("Error loading customers:", error);
            this.showError("Failed to load customers");
        }
    }
    
    /**
     * Load customer statistics
     */
    private async loadCustomerStats(customer: CustomerCard): Promise<void> {
        try {
            // Fetch reservation count and total spent
            const fetchXml = `
                <fetch aggregate="true">
                    <entity name="es_reservation">
                        <attribute name="es_totalamount" alias="totalspent" aggregate="sum" />
                        <attribute name="es_reservationid" alias="count" aggregate="count" />
                        <filter>
                            <condition attribute="es_customercontactid" operator="eq" value="${customer.id}" />
                            <condition attribute="es_status" operator="in">
                                <value>3</value>
                                <value>4</value>
                                <value>5</value>
                            </condition>
                        </filter>
                    </entity>
                </fetch>
            `;
            
            const result = await this._context.webAPI.retrieveMultipleRecords("es_reservation", `?fetchXml=${encodeURIComponent(fetchXml)}`);
            
            if (result.entities.length > 0) {
                customer.reservationCount = result.entities[0]["count"] || 0;
                customer.totalSpent = result.entities[0]["totalspent"] || 0;
            }
            
            // Calculate rating based on activity
            if (customer.reservationCount) {
                if (customer.reservationCount >= 10) customer.rating = 5;
                else if (customer.reservationCount >= 5) customer.rating = 4;
                else if (customer.reservationCount >= 2) customer.rating = 3;
                else customer.rating = 2;
            }
            
        } catch (error) {
            console.error("Error loading customer stats:", error);
        }
    }
    
    /**
     * Render customer cards
     */
    private renderCustomers(): void {
        this._customersContainer.innerHTML = "";
        
        const filteredCustomers = this.getFilteredCustomers();
        const cardLayout = this._context.parameters.cardLayout.raw || "compact";
        
        filteredCustomers.forEach(customer => {
            const card = this.createCustomerCard(customer, cardLayout);
            this._customersContainer.appendChild(card);
        });
        
        if (filteredCustomers.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.innerHTML = `
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#666"/>
                    <path d="M11 7h2v6h-2zm0 8h2v2h-2z" fill="#666"/>
                </svg>
                <h3>No customers found</h3>
                <p>Try adjusting your search or filter criteria</p>
            `;
            this._customersContainer.appendChild(emptyState);
        }
    }
    
    /**
     * Create customer card element
     */
    private createCustomerCard(customer: CustomerCard, layout: string): HTMLElement {
        const card = document.createElement("div");
        card.className = `customer-card ${layout}`;
        card.dataset.customerId = customer.id;
        
        // Card header with avatar and basic info
        const header = document.createElement("div");
        header.className = "card-header";
        
        const avatar = document.createElement("div");
        avatar.className = "customer-avatar";
        avatar.innerHTML = customer.imageUrl 
            ? `<img src="${customer.imageUrl}" alt="${customer.name}" />`
            : `<span>${this.getInitials(customer.name)}</span>`;
        
        const info = document.createElement("div");
        info.className = "customer-info";
        info.innerHTML = `
            <h3>${customer.name}</h3>
            ${customer.company ? `<p class="company">${customer.company}</p>` : ""}
            <p class="type-badge ${customer.type}">${customer.type}</p>
        `;
        
        header.appendChild(avatar);
        header.appendChild(info);
        card.appendChild(header);
        
        // Card body with details
        if (layout !== "compact") {
            const body = document.createElement("div");
            body.className = "card-body";
            
            const details = [];
            
            if (customer.email) {
                details.push(`<div class="detail-item">
                    <span class="icon">📧</span>
                    <span>${customer.email}</span>
                </div>`);
            }
            
            if (customer.phone) {
                details.push(`<div class="detail-item">
                    <span class="icon">📱</span>
                    <span>${customer.phone}</span>
                </div>`);
            }
            
            if (this._context.parameters.showReservationCount.raw && customer.reservationCount !== undefined) {
                details.push(`<div class="detail-item">
                    <span class="icon">📅</span>
                    <span>${customer.reservationCount} reservations</span>
                </div>`);
            }
            
            if (layout === "detailed" && customer.totalSpent !== undefined) {
                details.push(`<div class="detail-item">
                    <span class="icon">💰</span>
                    <span>$${customer.totalSpent.toFixed(2)}</span>
                </div>`);
            }
            
            if (customer.rating) {
                details.push(`<div class="detail-item">
                    <span class="icon">⭐</span>
                    <span>${"★".repeat(customer.rating)}${"☆".repeat(5 - customer.rating)}</span>
                </div>`);
            }
            
            body.innerHTML = details.join("");
            card.appendChild(body);
        }
        
        // Card footer with actions
        if (this._context.parameters.enableQuickActions.raw) {
            const footer = document.createElement("div");
            footer.className = "card-footer";
            
            const actions = document.createElement("div");
            actions.className = "quick-actions";
            actions.innerHTML = `
                <button class="action-btn" data-action="view" title="View Details">
                    <span>👁️</span>
                </button>
                <button class="action-btn" data-action="email" title="Send Email">
                    <span>✉️</span>
                </button>
                <button class="action-btn" data-action="reservation" title="New Reservation">
                    <span>➕</span>
                </button>
            `;
            
            // Add event listeners for actions
            actions.querySelectorAll(".action-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const action = (e.currentTarget as HTMLElement).dataset.action;
                    this.handleQuickAction(customer, action!);
                });
            });
            
            footer.appendChild(actions);
            card.appendChild(footer);
        }
        
        // Card click handler
        card.addEventListener("click", () => {
            this.selectCustomer(customer);
        });
        
        return card;
    }
    
    /**
     * Get initials from name
     */
    private getInitials(name: string): string {
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return parts[0][0] + parts[parts.length - 1][0];
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    /**
     * Filter customers based on search and filter criteria
     */
    private filterCustomers(): void {
        this.renderCustomers();
    }
    
    /**
     * Get filtered customers
     */
    private getFilteredCustomers(): CustomerCard[] {
        let filtered = [...this._customers];
        
        // Apply search filter
        const searchTerm = this._searchInput.value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(c => 
                c.name.toLowerCase().includes(searchTerm) ||
                c.email.toLowerCase().includes(searchTerm) ||
                c.phone.includes(searchTerm) ||
                (c.company && c.company.toLowerCase().includes(searchTerm))
            );
        }
        
        // Apply type filter
        const filterType = this._filterDropdown.value;
        if (filterType !== "all") {
            switch (filterType) {
                case "contact":
                case "lead":
                case "account":
                    filtered = filtered.filter(c => c.type === filterType);
                    break;
                case "active":
                    filtered = filtered.filter(c => c.status === "active");
                    break;
                case "vip":
                    filtered = filtered.filter(c => c.rating && c.rating >= 4);
                    break;
            }
        }
        
        return filtered;
    }
    
    /**
     * Update statistics bar
     */
    private updateStats(): void {
        const statsBar = document.getElementById("statsBar");
        if (!statsBar) return;
        
        const filtered = this.getFilteredCustomers();
        const totalReservations = filtered.reduce((sum, c) => sum + (c.reservationCount || 0), 0);
        const totalRevenue = filtered.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        
        statsBar.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Total Customers:</span>
                <span class="stat-value">${filtered.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Reservations:</span>
                <span class="stat-value">${totalReservations}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Revenue:</span>
                <span class="stat-value">$${totalRevenue.toFixed(2)}</span>
            </div>
        `;
    }
    
    /**
     * Update grid layout based on max cards per row
     */
    private updateGridLayout(): void {
        const maxCards = this._context.parameters.maxCardsPerRow.raw || 4;
        this._customersContainer.style.gridTemplateColumns = `repeat(auto-fill, minmax(${100/maxCards - 2}%, 1fr))`;
    }
    
    /**
     * Select a customer
     */
    private selectCustomer(customer: CustomerCard): void {
        this._selectedCustomerId = customer.id;
        
        // Update visual selection
        this._customersContainer.querySelectorAll(".customer-card").forEach(card => {
            card.classList.remove("selected");
        });
        
        const selectedCard = this._customersContainer.querySelector(`[data-customer-id="${customer.id}"]`);
        if (selectedCard) {
            selectedCard.classList.add("selected");
        }
        
        // Notify output changed
        this._notifyOutputChanged();
        
        // Open record
        this._context.navigation.openForm({
            entityName: customer.type,
            entityId: customer.id,
            openInNewWindow: false
        });
    }
    
    /**
     * Handle quick actions
     */
    private handleQuickAction(customer: CustomerCard, action: string): void {
        switch (action) {
            case "view":
                this._context.navigation.openForm({
                    entityName: customer.type,
                    entityId: customer.id,
                    openInNewWindow: true
                });
                break;
                
            case "email":
                // Open email form
                this._context.navigation.openForm({
                    entityName: "email",
                    useQuickCreateForm: true,
                    createFromEntity: {
                        entityType: customer.type,
                        id: customer.id
                    }
                });
                break;
                
            case "reservation":
                // Open new reservation form
                this._context.navigation.openForm({
                    entityName: "es_reservation",
                    useQuickCreateForm: true,
                    createFromEntity: {
                        entityType: customer.type,
                        id: customer.id,
                        name: customer.name
                    }
                });
                break;
        }
    }
    
    /**
     * Show error message
     */
    private showError(message: string): void {
        const errorDiv = document.createElement("div");
        errorDiv.className = "error-message";
        errorDiv.textContent = message;
        this._container.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    /**
     * Apply custom styles
     */
    private applyStyles(): void {
        const primaryColor = this._context.parameters.primaryColor.raw || "#0078D4";
        const style = document.createElement("style");
        style.textContent = `
            .customer-card:hover {
                border-color: ${primaryColor};
            }
            .customer-card.selected {
                border-color: ${primaryColor};
                box-shadow: 0 0 0 2px ${primaryColor}20;
            }
            .type-badge {
                background: ${primaryColor}20;
                color: ${primaryColor};
            }
            .action-btn:hover {
                background: ${primaryColor};
                color: white;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Called when any value in the property bag has changed
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        
        // Check if dataset has changed
        if (context.parameters.customersDataSet.loading === false) {
            this.loadCustomers();
        }
        
        // Update layout if needed
        if (context.updatedProperties.includes("maxCardsPerRow")) {
            this.updateGridLayout();
        }
        
        // Update colors if changed
        if (context.updatedProperties.includes("primaryColor")) {
            this.applyStyles();
        }
    }
    
    /**
     * Get outputs
     */
    public getOutputs(): IOutputs {
        return {};
    }
    
    /**
     * Called when the control is to be removed from the DOM tree
     */
    public destroy(): void {
        // Cleanup
    }
}