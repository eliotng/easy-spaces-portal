// Mock implementation of Power Platform CLI (pac) commands for testing

class PacCliMock {
    constructor() {
        this.authenticated = false;
        this.currentEnvironment = null;
        this.solutions = [];
        this.entities = [];
        this.canvasApps = [];
    }

    // Authentication commands
    async authList() {
        if (!this.authenticated) {
            return 'No authentication profiles found';
        }
        return `
Index  Active  Kind       Name                     Url                                              User                        
[1]    *       UNIVERSAL  test@example.com         https://test.crm.dynamics.com                   test@example.com           
        `;
    }

    async authCreate(url, username = 'test@example.com') {
        if (!url) {
            throw new Error('URL is required for authentication');
        }
        
        this.authenticated = true;
        this.currentEnvironment = url;
        
        return `Authentication profile created successfully for ${url}`;
    }

    async authSelect(index) {
        if (!this.authenticated) {
            throw new Error('No authentication profiles available');
        }
        return `Selected authentication profile [${index}]`;
    }

    async authClear() {
        this.authenticated = false;
        this.currentEnvironment = null;
        return 'Authentication profiles cleared';
    }

    // Solution commands
    async solutionInit(publisherName, publisherPrefix) {
        if (!publisherName || !publisherPrefix) {
            throw new Error('Publisher name and prefix are required');
        }
        
        const solution = {
            name: `${publisherPrefix}_solution`,
            publisherName,
            publisherPrefix,
            version: '1.0.0.0',
            createdAt: new Date().toISOString()
        };
        
        this.solutions.push(solution);
        return `Solution initialized: ${solution.name}`;
    }

    async solutionExport(path, name, managed = false) {
        const solution = this.solutions.find(s => s.name === name);
        if (!solution) {
            throw new Error(`Solution '${name}' not found`);
        }
        
        return `Solution exported to ${path} (${managed ? 'managed' : 'unmanaged'})`;
    }

    async solutionImport(path) {
        if (!path) {
            throw new Error('Solution file path is required');
        }
        
        if (!path.endsWith('.zip')) {
            throw new Error('Solution file must be a .zip file');
        }
        
        return `Solution imported successfully from ${path}`;
    }

    async solutionList() {
        if (this.solutions.length === 0) {
            return 'No solutions found';
        }
        
        return this.solutions.map(s => 
            `${s.name} | ${s.version} | ${s.publisherName}`
        ).join('\n');
    }

    // Canvas app commands
    async canvasPack(sources, msapp) {
        if (!sources || !msapp) {
            throw new Error('Source folder and MSAPP file path are required');
        }
        
        return `Canvas app packed successfully: ${msapp}`;
    }

    async canvasUnpack(msapp, sources) {
        if (!msapp || !sources) {
            throw new Error('MSAPP file and source folder are required');
        }
        
        if (!msapp.endsWith('.msapp')) {
            throw new Error('Invalid MSAPP file format');
        }
        
        return `Canvas app unpacked successfully to ${sources}`;
    }

    async canvasCreate(name, displayName) {
        if (!name) {
            throw new Error('App name is required');
        }
        
        const app = {
            id: `app-${Date.now()}`,
            name,
            displayName: displayName || name,
            version: '1.0.0',
            createdAt: new Date().toISOString()
        };
        
        this.canvasApps.push(app);
        return `Canvas app created: ${app.name} (${app.id})`;
    }

    async canvasList() {
        if (this.canvasApps.length === 0) {
            return 'No canvas apps found';
        }
        
        return this.canvasApps.map(app => 
            `${app.id} | ${app.name} | ${app.version}`
        ).join('\n');
    }

    // Power Pages commands
    async powerpagesDownload(path, webSiteId) {
        if (!path || !webSiteId) {
            throw new Error('Path and website ID are required');
        }
        
        return `Power Pages site downloaded to ${path}`;
    }

    async powerpagesUpload(path) {
        if (!path) {
            throw new Error('Path is required');
        }
        
        return `Power Pages site uploaded from ${path}`;
    }

    async powerpagesList() {
        return `
ID                                    Name                    URL
------------------------------------  ----------------------  --------------------------------
23f043c6-aa87-42c1-8d5c-4015e7b59c26  Easy Spaces Portal     https://easyspaces.powerappsportals.com
        `;
    }

    // PCF commands
    async pcfInit(namespace, name, template) {
        if (!namespace || !name || !template) {
            throw new Error('Namespace, name, and template are required');
        }
        
        return `PCF control initialized: ${namespace}.${name}`;
    }

    async pcfBuild(production = false) {
        return `PCF control built successfully (${production ? 'production' : 'development'} mode)`;
    }

    async pcfPush(publisherPrefix) {
        if (!publisherPrefix) {
            throw new Error('Publisher prefix is required');
        }
        
        return `PCF control pushed to environment`;
    }

    // Plugin commands
    async pluginInit() {
        return 'Plugin project initialized';
    }

    // ModelBuilder commands (for AI Builder)
    async modelbuilderList() {
        return `
Name                    Type                Status
----------------------  ------------------  --------
Invoice Processing      Document Processing Published
Sentiment Analysis      Text Classification Published
        `;
    }

    // Data commands
    async dataExport(entityName, filePath) {
        if (!entityName || !filePath) {
            throw new Error('Entity name and file path are required');
        }
        
        return `Data exported from ${entityName} to ${filePath}`;
    }

    async dataImport(filePath, entityName) {
        if (!filePath || !entityName) {
            throw new Error('File path and entity name are required');
        }
        
        return `Data imported to ${entityName} from ${filePath}`;
    }

    // Execute mock command
    async execute(command, ...args) {
        const commandMap = {
            'auth list': () => this.authList(),
            'auth create': () => this.authCreate(args[0]),
            'auth select': () => this.authSelect(args[0]),
            'auth clear': () => this.authClear(),
            'solution init': () => this.solutionInit(args[0], args[1]),
            'solution export': () => this.solutionExport(args[0], args[1], args[2]),
            'solution import': () => this.solutionImport(args[0]),
            'solution list': () => this.solutionList(),
            'canvas pack': () => this.canvasPack(args[0], args[1]),
            'canvas unpack': () => this.canvasUnpack(args[0], args[1]),
            'canvas create': () => this.canvasCreate(args[0], args[1]),
            'canvas list': () => this.canvasList(),
            'powerpages download': () => this.powerpagesDownload(args[0], args[1]),
            'powerpages upload': () => this.powerpagesUpload(args[0]),
            'powerpages list': () => this.powerpagesList(),
            'pcf init': () => this.pcfInit(args[0], args[1], args[2]),
            'pcf build': () => this.pcfBuild(args[0]),
            'pcf push': () => this.pcfPush(args[0]),
            'plugin init': () => this.pluginInit(),
            'modelbuilder list': () => this.modelbuilderList(),
            'data export': () => this.dataExport(args[0], args[1]),
            'data import': () => this.dataImport(args[0], args[1])
        };

        const handler = commandMap[command];
        if (!handler) {
            throw new Error(`Unknown command: pac ${command}`);
        }

        return await handler();
    }

    // Reset mock state
    reset() {
        this.authenticated = false;
        this.currentEnvironment = null;
        this.solutions = [];
        this.entities = [];
        this.canvasApps = [];
    }
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PacCliMock;
}