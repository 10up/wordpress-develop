/**
 * Handles delayed execution of before/after inline scripts for defer/async scripts.
 *
 * @output wp-includes/js/wp-delayed-inline-script-loader.js
 */

(function (window, document) {
	var nonce = document.currentScript.nonce,
		doneDependencies = new Set();

	/**
	 * Determines whether a script was loaded.
	 *
	 * @param {string} dep Dependency handle.
	 * @returns {boolean} Whether dependency was done.
	 */
	function isDependencyDone(dep) {
		if ( doneDependencies.has(dep) ) {
			return true;
		}

		// If the dependency doesn't exist in the document, it must be an alias.
		console.info( 'is it done: ', dep )
		if ( ! ( document.getElementById( dep + '-js' ) instanceof HTMLScriptElement ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Runs an inline script.
	 *
	 * @param {HTMLScriptElement} script Script to run.
	 */
	function runInlineScript(script) {
		var newScript;
		script.dataset.wpDone = '1';
		if (nonce && nonce !== script.nonce) {
			console.error(
				'CSP nonce check failed for after inline script. Execution aborted.',
				script
			);
			return;
		}
		newScript = script.cloneNode(true);
		newScript.type = 'text/javascript';
		script.parentNode.replaceChild(newScript, script);
	}

	/**
	 * Get deps data.
	 *
	 * @param {HTMLScriptElement} scriptElement Script element.
	 */
	function getDepsData( scriptElement ) {
		if ( ! scriptElement.dataset.wpDeps ) {
			return [];
		}
		return scriptElement.dataset.wpDeps.split(/,/);
	}

	/**
	 * Runs the supplied inline scripts if all of their dependencies have been done.
	 *
	 * @param {NodeList<HTMLScriptElement>} scripts Scripts to run if ready.
	 */
	function runReadyInlineScripts(scripts) {
		var i, len;
		for (i = 0, len = scripts.length; i < len; i++) {
			if (getDepsData(scripts[i]).every(isDependencyDone)) { // TODO: We don't really need data-wp-deps on the inline script if it is on the main script.
				runInlineScript(scripts[i]);
			}
		}
	}

	window.wpBeforeInlineScripts = function () {

	};

	/**
	 * Runs whenever a load event happens.
	 *
	 * @param {Event} event Event.
	 */
	function onScriptLoad(event) {
		var matches, handle, script, deps;
		if (!(event.target instanceof HTMLScriptElement || event.target.id)) {
			return;
		}

		matches = event.target.id.match(/^(.+)-js$/);
		if (!matches) {
			return;
		}
		handle = matches[1];
		doneDependencies.add(handle);

		console.info( 'LOAD', event.target );
		console.info( 'doneDependencies', doneDependencies );

		// Add all deps on the script as well. This is needed for the case of a script alias being a dependency for a delayed dependency.
		getDepsData(event.target).forEach(function ( dep ) {
			doneDependencies.add( dep );
			console.info( 'ADDED DEP: ' + dep );
		});

		/*
		 * //Return now if blocking because we cannot run delayed inline scripts because if we do, we could accidentally
		 * //run the before inline script for a dependent _before_ the after script of this blocking script is evaluated.
		 */

		// First, run all inline after scripts which are associated with this handle.
		if (event.target.async || event.target.defer) {
			script = document.querySelector(
				'script:not([src])[type="text/plain"][id="' + handle + '-js-after"]'
			);
			if (script instanceof HTMLScriptElement) {
				runInlineScript(script);
			}
		}

		// Next, run all pending inline before scripts for all dependents for which all dependencies have loaded.
		const scripts = document.querySelectorAll(
			'script:not([src])[type="text/plain"][data-wp-deps][id$="-js-before"]:not([data-wp-done])'
		);
		console.log(Array.from( scripts ))
		runReadyInlineScripts(
			scripts
		);
	}

	document.addEventListener('load', onScriptLoad, true);

	window.addEventListener(
		'load',
		function () {
			document.removeEventListener('load', onScriptLoad, true);
		},
		{ once: true }
	);
})(window, document);
