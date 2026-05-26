use rquickjs::{Ctx, Result, Value, class::Trace};

use crate::runtime::js::util;

#[derive(Clone, Trace, Default)]
#[rquickjs::class(frozen)]
pub(super) struct RustRedClass {}

unsafe impl<'js> rquickjs::JsLifetime<'js> for RustRedClass {
    type Changed<'to> = RustRedClass;
}

#[allow(non_snake_case)]
#[rquickjs::methods]
impl<'js> RustRedClass {
    /// Deep clone a JS object
    #[qjs(rename = "deepClone")]
    fn deep_clone(&self, obj: Value<'js>, ctx: Ctx<'js>) -> Result<Value<'js>> {
        util::deep_clone(ctx, obj)
    }
}
