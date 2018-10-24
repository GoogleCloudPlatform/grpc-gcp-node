# How To Add NodeJs Probers for Cloud APIs

The gRPC Cloudprober supports NodeJs probers. Following steps
shows how to add probes for a new Cloud API in NodeJs. For this
instruction, we take Firestore API as an example and walk through the process of
adding NodeJs probes for Firestore.

## Add Cloud API Probes

The source code of the probes lives in [grpc_gcp_prober](../cloudprober/grpc_gcp_prober),
you will need to modify this folder to add probes for new APIs.

### Implement new probes

Create a new module named `firestore_probes.js` inside the source folder, and
implement NodeJs probes for the new cloud API. For example, if you want to test the `ListDocuments` call from firestore stub:

```javascript
function documents(client, metrics) {
  return new Promise((resolve, reject) => {
    var listDocsRequest = new firestore.ListDocumentsRequest();
    listDocsRequest.setParent(_PARENT_RESOURCE);
    var start = new Date();
    client.listDocuments(listDocsRequest, (error, response) => {
      if (error) {
        reject(error);
      } else {
        var latency = (new Date() - start);
        metrics['list_documents_latency_ms'] = latency;
        var docArray = response.getDocumentsList();
        if (!docArray || !docArray.length) {
          reject(new Error(
              'ListDocumentsResponse should have more than 1 document'));
        }
        resolve();
      }
    });
  });
}
```

Use a dict to map the probe name and the probe method.

```javascript
exports.probeFunctions = {
  'documents': documents
};
```

Notice that `client` and `metrics` objects are initialized in `prober.js`. We will
discuss them in later sections. For complete code, check [firestore_probes.js](../cloudprober/grpc_gcp_prober/firestore_probes.js).

### Register new API stub

Register the new cloud API in [prober.js](../cloudprober/grpc_gcp_prober/prober.js). `prober.js` is an entrypoint for all the probes of different cloud APIs. It creates
the stub for the api and executes the probe functions defined for the specific cloud api.

```javascript
const {GoogleAuth} = require('google-auth-library');

function executeProbes(api) {
  // Some other code
  if (api === 'firestore') {
    var client =
        new firestore_grpc.FirestoreClient(_FIRESTORE_TARGET, channelCreds);
    var probeFunctions = firestore_probes.probeFunctions;
  } else if (api === 'spanner') {
    var client =
        new spanner_grpc.SpannerClient(_SPANNER_TARGET, channelCreds);
    var probeFunctions = spanner_probes.probeFunctions;
  } else {
    throw new Error('gRPC prober is not implemented for ' + api + ' !');
  }
  // Some other code
}
```

### Register probe in cloudprober

Add the new probe you just implemented to [cloudprober.cfg](../cloudprober/cloudprober.cfg), so that when cloudprober is running, it will executes the probe and forward all metrics to
Stackdriver. Use the template just like the other probes.

```
probe {
  type: EXTERNAL
  name: "firestore"
  interval_msec: 1800000
  timeout_msec: 30000
  targets { dummy_targets {} }  # No targets for external probe
  external_probe {
    mode: ONCE
    command: "node /grpc-gcp-node/cloudprober/grpc_gcp_prober/prober.js --api=firestore"
  }
}
```

## Stackdriver Mornitoring

Use the [StackdriverUtil](../cloudprober/grpc_gcp_prober/stackdriver_util.js)
to add custom metrics.

```javascript
var util = new stackdriver_util.StackdriverUtil(api);
util.addMetrics(metrics);
```

The StackdriverUtil will format the output (e.g. "read_latency_ms 100") so they
can be scraped by cloudprober and then metrics will be automatically created and
forwarded to Stackdriver as [Custom Metrics](https://cloud.google.com/monitoring/custom-metrics/). Later on, the metrics can be retrieved via [Metric Explore](https://app.google.stackdriver.com/metrics-explorer).
The full name of the metric will be in the following format:

```
custom.googleapis.com/cloudprober/external/<probe_name>/<metirc>
```

## Stackdriver Error Reporting
[StackdriverUtil](../cloudprober/grpc_gcp_prober/stackdriver_util.py) also helps setting up
[Error Reporting](https://cloud.google.com/error-reporting/docs/setup/python)
to report any Error occurred during probes. In this way, if anything unusual
occurs, it can be reported immediately.

By default, all exceptions thrown by any probe will be reported to Error
Reporting by StackdriverUtil.

## Alerting Notification

There are two ways you can be notified for alerts:

1. Add [Alerting Policy](https://cloud.google.com/monitoring/alerts/) in
Stackdriver Monitoring. And set up notification when certain metircs are absent
or beyond/below a certain threshold.

2. Set up [Email Notification](https://cloud.google.com/error-reporting/docs/notifications)
in Error Reporting. The alert will be triggered whenever an Error/Exception is
reported by google-cloud-error-reporting client. Note that this option does not
support email alias, you need to use the email that is associated with the
Google Account and with necessary IAM roles.
