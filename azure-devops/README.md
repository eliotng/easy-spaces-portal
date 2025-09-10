# Azure DevOps Pipeline Setup for Easy Spaces Canvas Apps

This guide provides step-by-step instructions for setting up automated deployment of Easy Spaces canvas apps to Dynamics 365 using Azure DevOps.

## 📋 Prerequisites

1. **Azure DevOps Organization** with a project created
2. **Azure AD Global Administrator** or **Application Administrator** role
3. **Power Platform System Administrator** role
4. **Azure CLI** installed locally
5. **Power Platform CLI** installed (`npm install -g @microsoft/powerapps-cli`)
6. **Power Platform Build Tools** extension installed in Azure DevOps

## 🚀 Quick Start

### Step 1: Create Service Principal

Run the setup script to create a service principal with required permissions:

```powershell
./azure-devops/Setup-ServicePrincipal.ps1 `
    -TenantId "your-tenant-id" `
    -DisplayName "PowerPlatform-DevOps-ServicePrincipal" `
    -EnvironmentUrl "https://yourorg.crm.dynamics.com"
```

Save the output credentials securely - you'll need them for the next steps.

### Step 2: Register Application User in Power Platform

1. Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
2. Navigate to **Environments** → Select your environment → **Settings** → **Users + permissions** → **Application users**
3. Click **New app user** and add:
   - **App ID**: Use the Application ID from Step 1
   - **Business Unit**: Select your business unit
   - **Security Roles**: Assign **System Administrator** role
4. Click **Create**

### Step 3: Configure Azure DevOps

#### Create Service Connection

1. In Azure DevOps, go to **Project Settings** → **Service connections**
2. Click **New service connection** → **Power Platform**
3. Enter:
   - **Server URL**: Your environment URL
   - **Tenant ID**: Your Azure AD tenant ID
   - **Application ID**: From Step 1
   - **Client Secret**: From Step 1
   - **Service connection name**: `PowerPlatformServiceConnection`
4. Click **Save**

#### Create Variable Groups

Run the configuration script:

```powershell
./azure-devops/Configure-Variables.ps1 `
    -OrganizationUrl "https://dev.azure.com/yourorg" `
    -ProjectName "YourProject" `
    -PersonalAccessToken "your-pat-token" `
    -ClientId "app-id-from-step-1" `
    -ClientSecret "secret-from-step-1"
```

Or manually create these variable groups in **Pipelines** → **Library**:

1. **PowerPlatform-Credentials**
   - `ClientId`: Application ID
   - `ClientSecret`: Client secret (mark as secret)
   - `TenantId`: Tenant ID
   - `EnvironmentUrl`: Environment URL

2. **PowerPlatform-Dev/Test/Prod** (one for each environment)
   - `EnvironmentUrl`: Environment-specific URL
   - `SolutionPrefix`: Environment prefix (dev/test/prod)
   - `PublishManagedSolution`: true/false
   - `EnableFlows`: true/false

### Step 4: Create Pipeline

1. In Azure DevOps, go to **Pipelines** → **New Pipeline**
2. Select your repository
3. Choose **Existing Azure Pipelines YAML file**
4. Select `/azure-devops/azure-pipelines.yml`
5. Click **Run** to create and execute the pipeline

## 📁 Project Structure

```
azure-devops/
├── azure-pipelines.yml           # Main pipeline configuration
├── Setup-ServicePrincipal.ps1    # Creates service principal
├── Configure-Variables.ps1       # Sets up variable groups
├── Deploy-CanvasApps.ps1        # Deployment script
├── Validate-Deployment.ps1       # Validation script
├── environments/                 # Environment configurations
│   ├── dev.json
│   ├── test.json
│   └── prod.json
└── README.md                    # This file
```

## 🔄 Pipeline Stages

### 1. Build Stage
- Converts JSON app definitions to Power Fx format
- Packs canvas apps to .msapp format
- Creates solution package
- Runs solution checker
- Publishes artifacts

### 2. Deploy to Development
- Triggers on commits to `develop` branch
- Imports unmanaged solution
- Publishes customizations
- Activates flows

### 3. Deploy to Test
- Requires successful Dev deployment
- Imports managed solution
- Runs smoke tests
- Requires approval

### 4. Deploy to Production
- Triggers on commits to `main` branch
- Requires approvals from designated approvers
- Imports managed solution
- Runs comprehensive validation
- Creates rollback package

## 🛠️ Manual Deployment

For manual deployment, use the deployment script:

```powershell
./azure-devops/Deploy-CanvasApps.ps1 `
    -EnvironmentUrl "https://yourorg.crm.dynamics.com" `
    -ClientId "your-app-id" `
    -ClientSecret "your-secret" `
    -TenantId "your-tenant-id" `
    -ConfigFile "./azure-devops/environments/dev.json"
```

## ✅ Validation

Run validation after deployment:

```powershell
./azure-devops/Validate-Deployment.ps1 `
    -EnvironmentUrl "https://yourorg.crm.dynamics.com" `
    -ClientId "your-app-id" `
    -ClientSecret "your-secret" `
    -TenantId "your-tenant-id" `
    -DetailedReport
```

## 🔧 Troubleshooting

### Common Issues

1. **"Unhandled exception during import"**
   - Ensure service principal has proper permissions
   - Check that Dataverse tables exist
   - Verify solution dependencies

2. **"Authentication failed"**
   - Verify service principal credentials
   - Check application user registration in Power Platform
   - Ensure tenant ID is correct

3. **"Canvas app not found"**
   - Check JSON to Power Fx conversion logs
   - Verify .msapp packaging succeeded
   - Review solution import logs

4. **"Permission denied"**
   - Verify service principal has System Administrator role
   - Check Azure AD permissions
   - Ensure admin consent was granted

### Debug Mode

Enable detailed logging in pipeline:

```yaml
variables:
  System.Debug: true
```

### View Logs

1. Go to pipeline run in Azure DevOps
2. Click on failed stage/job
3. Review detailed logs for each task
4. Check artifact contents for generated files

## 📊 Monitoring

### Pipeline Metrics
- Average build time: ~5 minutes
- Average deployment time: ~3 minutes per environment
- Success rate target: >95%

### Key Performance Indicators
- Deployment frequency
- Lead time for changes
- Mean time to recovery
- Change failure rate

## 🔐 Security Best Practices

1. **Credentials Management**
   - Store secrets in Azure Key Vault
   - Use managed identities where possible
   - Rotate service principal secrets regularly
   - Never commit secrets to source control

2. **Access Control**
   - Limit service principal permissions to minimum required
   - Use separate service principals per environment
   - Implement approval gates for production deployments
   - Audit service connection usage

3. **Environment Isolation**
   - Use separate Azure AD app registrations per environment
   - Implement network restrictions where applicable
   - Enable audit logging in all environments

## 📚 Additional Resources

- [Power Platform Build Tools Documentation](https://docs.microsoft.com/en-us/power-platform/alm/devops-build-tools)
- [Canvas Apps ALM Guide](https://docs.microsoft.com/en-us/power-apps/maker/canvas-apps/dev-enterprise-intro)
- [Azure DevOps YAML Schema](https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema)
- [Power Platform CLI Reference](https://docs.microsoft.com/en-us/power-platform/developer/cli/reference)

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review pipeline logs for detailed error messages
3. Consult Power Platform admin center for environment issues
4. Contact your DevOps team for pipeline configuration

## 🔄 Updates

This pipeline configuration is version 1.0.0. Check for updates:
- Review changelog in repository
- Monitor Power Platform Build Tools updates
- Check for new Azure DevOps features

---

**Last Updated**: December 2024
**Maintained By**: DevOps Team
**Version**: 1.0.0