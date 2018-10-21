include Belt.Result;

let try_ = fn =>
  try (Ok(fn())) {
  | Js.Exn.Error(e) => Error(e)
  };

let getFirstError = resultList =>
  resultList
  |> List.fold_left(
       (finalMaybeError, currentResult) =>
         switch (finalMaybeError, currentResult) {
         | (Some(v), _) => Some(v)
         | (None, Ok(_)) => None
         | (None, Error(e)) => Some(e)
         },
       None,
     );

let sequence = resultList =>
  List.fold_left(
    (acc, item) =>
      acc->flatMap(accArray => item->map(v => List.append(accArray, v))),
    Ok([]),
    resultList,
  );