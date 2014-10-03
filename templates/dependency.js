function FUNCTION(ready, Template, modules) {
  var render;

  return function(state) {
    if (render) return render(state);

    PRE_WRAPPER
    return updateModule();

    function updateModule() {
      if (module.hot) {
        module.hot.accept(MODULE, function() {
          updateModule();
          ready();
        });
      }
      try {
        render = require(MODULE)(updateModule, Template, modules).render;
      } catch (err) {
        return ready(err);
      };
      RETURN_VALUE
    }
    POST_WRAPPER
  };
}
