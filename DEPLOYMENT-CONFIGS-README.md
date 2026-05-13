# Deployment Configurations

This file documents how to manage saved Embedded Service deployment configurations that are shared across all users of the demo pages.

## File Structure

The `deployment-configs.json` file contains an array of configuration objects. Each configuration has the following fields:

```json
{
  "configurations": [
    {
      "orgId": "15-character Salesforce Org ID",
      "deploymentName": "Embedded_Service_Deployment_API_Name",
      "siteEndpoint": "https://example.my.site.com/ESWDeploymentPath",
      "scrt2URL": "https://example.my.salesforce-scrt.com",
      "name": "Human-readable configuration name",
      "instance": "Instance identifier (e.g., USA794)",
      "instanceType": "Prod | Test | Dev",
      "clientType": "v1 | v2"
    }
  ]
}
```

## Field Descriptions

### Core Deployment Fields (from Salesforce)
- **orgId**: The 15-character Salesforce organization ID
- **deploymentName**: The API name of the Embedded Service Deployment
- **siteEndpoint**: The full URL of the Experience Cloud site hosting the deployment
- **scrt2URL**: The SCRT2 (Salesforce Customer Real-Time) endpoint URL

### Metadata Fields (user-provided)
- **name**: A descriptive name for this configuration (shown in the dropdown)
- **instance**: The Salesforce instance identifier (e.g., NA1, CS42, USA794)
- **instanceType**: The environment type - one of:
  - `Prod` - Production environment
  - `Test` - Test/sandbox environment
  - `Dev` - Development environment
- **clientType**: The Embedded Service version - one of:
  - `v1` - Enhanced Chat v1 (overlay mode)
  - `v2` - Enhanced Chat v2 (inline mode)

## Adding a New Configuration

### Option 1: Using the Demo Page UI

1. Open any demo page (e.g., `agentforceweb_d2a.html`)
2. Click the **☰ Menu** button to open the Page Settings panel
3. Expand the **Deployment Settings** section
4. Ensure **Manual** mode is selected
5. Paste your Embedded Service code snippet (or fill in the fields manually)
6. Check the **"Save this configuration for future use"** checkbox
7. Fill in the additional metadata fields:
   - Configuration Name
   - Instance
   - Instance Type
   - Client Type
8. Click **Update**
9. A modal will appear with the JSON configuration
10. Follow the instructions in the modal to add it to `deployment-configs.json` in GitHub

### Option 2: Manual Edit

1. Open `deployment-configs.json` in GitHub
2. Click the **Edit** (pencil) button
3. Add your new configuration object to the `configurations` array
4. Ensure the JSON remains valid (proper commas, brackets, etc.)
5. Commit your changes with a descriptive message

Example:
```json
{
  "configurations": [
    {
      "orgId": "00DWs00000CvEVZ",
      "deploymentName": "MIAW_Direct_to_Service_Rep",
      "siteEndpoint": "https://agentforceweb.demo.my.site.com/ESWMIAWDirecttoService1749749039230",
      "scrt2URL": "https://agentforceweb.demo.my.salesforce-scrt.com",
      "name": "Agentforceweb demo org",
      "instance": "USA794",
      "instanceType": "Prod",
      "clientType": "v1"
    },
    {
      "orgId": "00D5e0000000NewOrg",
      "deploymentName": "My_New_Deployment",
      "siteEndpoint": "https://mynewsite.my.site.com/ESWPath",
      "scrt2URL": "https://mynewsite.my.salesforce-scrt.com",
      "name": "My Test Org",
      "instance": "CS42",
      "instanceType": "Test",
      "clientType": "v2"
    }
  ]
}
```

## Using Saved Configurations

1. Open any demo page
2. Click **☰ Menu** → **Deployment Settings**
3. Toggle to **Saved** mode (switch on the right side)
4. Select a configuration from the dropdown
   - Format: `Name (InstanceType/Instance, ClientType)`
   - Example: `Agentforceweb demo org (Prod/USA794, v1)`
5. Click **Load Configuration**
6. The page will reload with the selected configuration

## Local Storage Fallback

If the GitHub file cannot be loaded (e.g., network issues), the system will fall back to configurations saved in browser `localStorage`. Any configuration you save via the UI is automatically stored locally as a backup.

## Best Practices

1. **Use descriptive names**: Help users identify configurations easily
2. **Keep it accurate**: Ensure instanceType and clientType match the actual deployment
3. **Test before committing**: Verify the configuration works before adding it to the shared file
4. **Group by purpose**: Consider organizing configs by team, project, or use case
5. **Document special cases**: If a config has special requirements, add a comment in the name

## Troubleshooting

### Configuration doesn't load
- Check that the JSON in `deployment-configs.json` is valid
- Verify all required fields are present
- Try the **Refresh List** button in the UI

### Changes don't appear
- GitHub Pages may cache the file; wait a few minutes or add `?t=timestamp` to force a refresh
- Clear your browser cache
- Use **Refresh List** button to bypass cache

### Local configurations missing
- Local configs are stored in `localStorage` and are browser-specific
- They don't sync across browsers or devices
- Export important configs to the GitHub file for sharing
